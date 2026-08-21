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
  account: Account
): Promise<IndustryTrendsSummary> {
  try {
    const trends = await researchIndustryTrends(
      { companyName: account.name, positioning: account.positioning, icp: account.icp },
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
