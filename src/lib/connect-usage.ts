import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { estimateCostUsd } from "@/lib/llm-pricing";
import { INLINE_CHARGED_FUNCTIONS } from "@/lib/connect-metering";
import { applyToWallet } from "@/lib/wallet-ledger";
import { CONNECT_MONITORING_FEE_PER_COMPETITOR_DAY_USD, chargeMicrosForCost, microsToUsd, usdToMicros } from "@/lib/connect-pricing";

type Admin = SupabaseClient<Database>;

// The UTC day before `now`, as [start, end) ISO timestamps plus a YYYY-MM-DD key.
export function previousUtcDay(now: Date): { key: string; start: string; end: string } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { key: start.toISOString().slice(0, 10), start: start.toISOString(), end: end.toISOString() };
}

export type DailyChargeResult = { charged: boolean; chargeUsd: number; llmCostUsd: number; competitors: number };

// Charges one Connect account for one UTC day of everything that ran on its
// behalf outside a metered call: the LLM cost of crawling, scoring and adding
// competitors (from llm_usage, at the model's list rate, plus the markup), and
// a flat monitoring fee per competitor watched. Idempotent per account per day
// (the day is the ledger ref), so a re-run or a late second run charges once.
// Answers are excluded here because they're charged when they happen.
export async function chargeDailyUsage(
  supabase: Admin,
  accountId: string,
  day: { key: string; start: string; end: string }
): Promise<DailyChargeResult> {
  const [{ data: usage }, { count: competitors }] = await Promise.all([
    supabase
      .from("llm_usage")
      .select("function_name, model, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, created_at")
      .eq("account_id", accountId)
      .gte("created_at", day.start)
      .lt("created_at", day.end)
      .not("function_name", "in", `(${INLINE_CHARGED_FUNCTIONS.map((f) => `"${f}"`).join(",")})`),
    supabase.from("competitors").select("id", { count: "exact", head: true }).eq("account_id", accountId),
  ]);

  const llmCostUsd = (usage ?? []).reduce(
    (sum, r) =>
      sum +
      estimateCostUsd(
        r.model,
        {
          input_tokens: r.input_tokens,
          output_tokens: r.output_tokens,
          cache_creation_tokens: r.cache_creation_tokens,
          cache_read_tokens: r.cache_read_tokens,
        },
        r.created_at
      ),
    0
  );
  const watched = competitors ?? 0;

  const chargeMicros = chargeMicrosForCost(llmCostUsd) + usdToMicros(watched * CONNECT_MONITORING_FEE_PER_COMPETITOR_DAY_USD);
  if (chargeMicros === 0) return { charged: false, chargeUsd: 0, llmCostUsd, competitors: watched };

  const result = await applyToWallet(supabase, accountId, {
    amountMicros: -chargeMicros,
    kind: "usage",
    ref: `daily:${day.key}`,
    description: `Monitoring ${watched} competitor${watched === 1 ? "" : "s"}, ${day.key}`,
    meta: { day: day.key, llmCostUsd, competitors: watched },
    // The day's work already happened. The crawl cron skips accounts at zero
    // balance, which is what stops this from growing.
    allowNegative: true,
  });
  return { charged: result.applied, chargeUsd: microsToUsd(chargeMicros), llmCostUsd, competitors: watched };
}
