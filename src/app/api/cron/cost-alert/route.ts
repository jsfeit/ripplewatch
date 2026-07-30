import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sumLlmUsageByAccount } from "@/lib/llm-pricing";
import { sendCostAlertEmail, type CostAlertAccount } from "@/lib/resend";
import { TIERS } from "@/lib/tiers";

const MONTHLY_USD_BY_TIER: Record<string, number> = Object.fromEntries(TIERS.map((t) => [t.id, t.monthlyUsd]));

// Threshold, not a hard rule: flags an account once its estimated LLM spend
// this calendar month exceeds 1.5x what its tier price budgets for at this
// point in the month (pro-rated by day-of-month elapsed, not the account's
// actual Stripe billing anchor — a deliberate simplification, see the
// checklist). A $5 floor avoids noise from trivial cent-level overages
// early in the month, when the pro-rated budget is still tiny.
const OVERAGE_MULTIPLIER = 1.5;
const MIN_FLOOR_USD = 5;

// Runs once daily. Alerts at most once per calendar month per account
// (cost_alert_sent_month), so an account that stays over threshold for the
// rest of the month doesn't get re-emailed every day.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const dayOfMonth = now.getUTCDate();
  const monthFraction = dayOfMonth / daysInMonth;

  const [{ data: usageRows }, { data: accounts }] = await Promise.all([
    supabase
      .from("llm_usage")
      .select("account_id, function_name, model, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, created_at")
      .gte("created_at", monthStart.toISOString()),
    supabase
      .from("accounts")
      .select("id, name, tier, subscription_status, cost_alert_sent_month")
      .in("subscription_status", ["active", "trialing"]),
  ]);

  const costByAccount = sumLlmUsageByAccount(usageRows ?? []);
  const flagged: (CostAlertAccount & { accountId: string })[] = [];

  for (const account of accounts ?? []) {
    if (account.cost_alert_sent_month === monthKey) continue;
    const tierPriceUsd = MONTHLY_USD_BY_TIER[account.tier];
    if (tierPriceUsd === undefined) continue;

    const actualUsd = costByAccount.get(account.id)?.costUsd ?? 0;
    const expectedUsd = tierPriceUsd * monthFraction;

    if (actualUsd > expectedUsd * OVERAGE_MULTIPLIER && actualUsd > MIN_FLOOR_USD) {
      flagged.push({ accountId: account.id, name: account.name, tier: account.tier, tierPriceUsd, expectedUsd, actualUsd });
    }
  }

  if (flagged.length > 0) {
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);

    try {
      await sendCostAlertEmail(adminEmails, flagged);
      await supabase
        .from("accounts")
        .update({ cost_alert_sent_month: monthKey })
        .in("id", flagged.map((f) => f.accountId));
    } catch (err) {
      console.error("cost-alert: failed to send alert email", err);
    }
  }

  return NextResponse.json({ ok: true, monthKey, checked: accounts?.length ?? 0, flagged: flagged.length });
}
