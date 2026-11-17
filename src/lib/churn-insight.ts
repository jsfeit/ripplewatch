import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { researchChurnBenchmark } from "@/lib/anthropic";
import { analyzeMetrics, type MetricPeriod, type MetricsRead } from "@/lib/customer-metrics";
import { lineUpChurn, type ChurnTiming, type CompetitorEvent } from "@/lib/churn-timing";
import { compareToBenchmark, parseBenchmark, type BenchmarkComparison, type ChurnBenchmark } from "@/lib/churn-benchmark";

type Admin = SupabaseClient<Database>;

// A benchmark is re-researched when it is older than this. Published churn ranges barely move.
const BENCHMARK_STALE_DAYS = 90;
// Tried again after this long when nothing credible was found, so an empty answer is not retried on every page view.
const BENCHMARK_EMPTY_RETRY_DAYS = 14;

export type ChurnInsight = {
  periods: MetricPeriod[];
  read: MetricsRead | null;
  timing: ChurnTiming | null;
  benchmark: ChurnBenchmark | null;
  comparison: BenchmarkComparison | null;
  // The market's growth direction in words, from the market profile. Never a number we made up.
  marketGrowth: { direction: string; reason: string | null } | null;
};

type StoredBenchmark = { found: ChurnBenchmark | null };

function daysSince(iso: string | null): number {
  return iso ? (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24) : Infinity;
}

// Researches the benchmark if there is none or it is stale, and saves it. Safe to call often: it
// returns right away when the stored answer is fresh. A failed or empty search stores an empty
// answer so it is not retried every time.
export async function refreshChurnBenchmark(supabase: Admin, accountId: string): Promise<void> {
  const { data: account } = await supabase
    .from("accounts")
    .select("name, sells_to, company_overview, positioning, icp, industry_benchmark, industry_benchmark_updated_at")
    .eq("id", accountId)
    .single();
  if (!account) return;

  const stored = account.industry_benchmark as StoredBenchmark | null;
  const age = daysSince(account.industry_benchmark_updated_at);
  if (stored?.found && age < BENCHMARK_STALE_DAYS) return;
  if (stored && !stored.found && age < BENCHMARK_EMPTY_RETRY_DAYS) return;

  let found: ChurnBenchmark | null = null;
  try {
    found = parseBenchmark(
      await researchChurnBenchmark(
        { companyName: account.name, overview: account.company_overview, positioning: account.positioning, icp: account.icp, sellsTo: account.sells_to },
        accountId
      )
    );
  } catch (err) {
    console.error("churn benchmark research failed:", err);
    return;
  }
  await supabase
    .from("accounts")
    .update({ industry_benchmark: { found } satisfies StoredBenchmark, industry_benchmark_updated_at: new Date().toISOString() })
    .eq("id", accountId);
}

// Runs the benchmark refresh after the response is sent, so saving numbers never waits on a web search.
export function refreshChurnBenchmarkInBackground(supabase: Admin, accountId: string): void {
  after(async () => {
    try {
      await refreshChurnBenchmark(supabase, accountId);
    } catch (err) {
      console.error("churn benchmark refresh failed:", err);
    }
  });
}

// Everything the customer, and their assistant, can be told about churn and growth: the read of their
// numbers, whether churn started rising near a competitor's move, and how it sits against a published range.
export async function loadChurnInsight(
  supabase: Admin,
  accountId: string,
  segment: "business" | "consumer" = "consumer",
  options: { refreshBenchmark?: boolean } = {}
): Promise<ChurnInsight> {
  const [{ data: rows }, { data: account }] = await Promise.all([
    supabase
      .from("customer_metrics")
      .select("period_start, customers_start, new_customers, cancelled_customers, customers_end, revenue, churn_pct")
      .eq("account_id", accountId)
      .eq("segment", segment)
      .order("period_start", { ascending: true }),
    supabase.from("accounts").select("industry_benchmark").eq("id", accountId).single(),
  ]);

  const periods: MetricPeriod[] = (rows ?? []).map((r) => ({
    periodStart: r.period_start,
    customersStart: r.customers_start,
    newCustomers: r.new_customers,
    cancelledCustomers: r.cancelled_customers,
    customersEnd: r.customers_end,
    revenue: r.revenue,
    churnPct: r.churn_pct,
  }));
  const read = periods.length > 0 ? analyzeMetrics(periods) : null;

  let timing: ChurnTiming | null = null;
  if (read?.trend === "rising" && read.risingSince) {
    const from = new Date(new Date(`${read.risingSince}T00:00:00Z`).getTime() - 40 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: competitors } = await supabase.from("competitors").select("id, name, sells_to").eq("account_id", accountId);
    const list = competitors ?? [];
    if (list.length > 0) {
      const { data: signals } = await supabase
        .from("signals")
        .select("competitor_id, type, title, occurred_on")
        .in("competitor_id", list.map((c) => c.id))
        .gte("occurred_on", from);
      const events: CompetitorEvent[] = (signals ?? []).flatMap((s) => {
        const c = list.find((x) => x.id === s.competitor_id);
        return c ? [{ competitorName: c.name, type: s.type, title: s.title, occurredOn: s.occurred_on, side: c.sells_to }] : [];
      });
      timing = lineUpChurn(read, events, segment);
    }
  }

  const stored = account?.industry_benchmark as StoredBenchmark | null;
  const benchmark = stored?.found ?? null;
  const comparison = read ? compareToBenchmark(read.latestChurn, benchmark) : null;

  let marketGrowth: ChurnInsight["marketGrowth"] = null;
  const { data: market } = await supabase.from("market_profile").select("growth_direction, growth_reason").eq("account_id", accountId).maybeSingle();
  if (market?.growth_direction) marketGrowth = { direction: market.growth_direction, reason: market.growth_reason ?? null };

  if (options.refreshBenchmark && read) refreshChurnBenchmarkInBackground(supabase, accountId);

  return { periods, read, timing, benchmark, comparison, marketGrowth };
}
