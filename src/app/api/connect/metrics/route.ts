import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/route-account";
import { analyzeMetrics, type MetricPeriod } from "@/lib/customer-metrics";
import { cleanPeriods } from "@/lib/customer-metrics-llm";

type Row = {
  period_start: string;
  customers_start: number | null;
  new_customers: number | null;
  cancelled_customers: number | null;
  customers_end: number | null;
  revenue: number | null;
  churn_pct: number | null;
};

const toPeriod = (r: Row): MetricPeriod => ({
  periodStart: r.period_start,
  customersStart: r.customers_start,
  newCustomers: r.new_customers,
  cancelledCustomers: r.cancelled_customers,
  customersEnd: r.customers_end,
  revenue: r.revenue,
  churnPct: r.churn_pct,
});

function segmentFrom(value: unknown): "business" | "consumer" {
  return value === "business" ? "business" : "consumer";
}

// Saved churn and growth for the account, with the read of it.
export async function GET(request: Request) {
  const auth = await requireAccount();
  if (!auth.ok) return auth.response;
  const segment = segmentFrom(new URL(request.url).searchParams.get("segment"));
  const { data } = await auth.supabase
    .from("customer_metrics")
    .select("period_start, customers_start, new_customers, cancelled_customers, customers_end, revenue, churn_pct")
    .eq("account_id", auth.accountId)
    .eq("segment", segment)
    .order("period_start", { ascending: true });
  const periods = ((data ?? []) as Row[]).map(toPeriod);
  return NextResponse.json({ periods, read: periods.length > 0 ? analyzeMetrics(periods) : null });
}

// Saves months of churn and growth. A month already saved for that side is updated, not duplicated.
export async function POST(request: Request) {
  const auth = await requireAccount();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const periods = cleanPeriods(body?.periods);
  if (periods.length === 0) return NextResponse.json({ error: "No usable months to save." }, { status: 400 });
  const segment = segmentFrom(body?.segment);

  const { error } = await auth.supabase.from("customer_metrics").upsert(
    periods.map((p) => ({
      account_id: auth.accountId,
      segment,
      period_start: p.periodStart,
      customers_start: p.customersStart,
      new_customers: p.newCustomers,
      cancelled_customers: p.cancelledCustomers,
      customers_end: p.customersEnd,
      revenue: p.revenue,
      churn_pct: p.churnPct,
      source: "setup",
      created_by: auth.userId,
    })),
    { onConflict: "account_id,segment,period_start" }
  );
  if (error) return NextResponse.json({ error: "Could not save that." }, { status: 500 });
  return NextResponse.json({ saved: periods.length, read: analyzeMetrics(periods) });
}
