import "server-only";
import { researchIndustryTrends } from "@/lib/anthropic";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type AdminSupabase = ReturnType<typeof createAdminClient>;
type Account = Database["public"]["Tables"]["accounts"]["Row"];

export type IndustryTrendsSummary = { account: string; trends: number; error?: string };

// Shared between the monthly cron (loops every account) and any future
// admin single-account trigger — same shape as runDiscoveryForAccount.
export async function runIndustryTrendsForAccount(
  supabase: AdminSupabase,
  account: Account,
  competitorNames: string[]
): Promise<IndustryTrendsSummary> {
  try {
    const trends = await researchIndustryTrends(
      { companyName: account.name, positioning: account.positioning, icp: account.icp },
      competitorNames,
      account.id
    );

    if (trends.length === 0) {
      return { account: account.name, trends: 0 };
    }

    const { error } = await supabase.from("industry_trends").insert({
      account_id: account.id,
      trends,
    });

    return { account: account.name, trends: error ? 0 : trends.length, error: error?.message };
  } catch (err) {
    console.error(`industry trends generation failed for ${account.name}:`, err);
    return { account: account.name, trends: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

// Self-heal for a brand-new (or pre-existing) account with no
// industry_trends row yet — without this, an account only ever gets its
// first market-trends synthesis whenever the monthly 1st-of-month cron
// next happens to fire, which could be weeks away. Fires at most once per
// account: the existence check below is what keeps every subsequent crawl
// from re-triggering it, so this adds no new recurring cost — it just
// moves the FIRST generation earlier, onto the account's first real
// crawl, instead of leaving "check back soon" showing for weeks.
export async function ensureIndustryTrends(
  supabase: AdminSupabase,
  account: Account,
  competitorNames: string[]
): Promise<void> {
  const { data: existing } = await supabase
    .from("industry_trends")
    .select("id")
    .eq("account_id", account.id)
    .limit(1)
    .maybeSingle();
  if (existing) return;

  await runIndustryTrendsForAccount(supabase, account, competitorNames);
}
