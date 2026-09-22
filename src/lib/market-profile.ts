import "server-only";
import { generateMarketProfile } from "@/lib/anthropic";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Database, IndustryTrendItem } from "@/lib/supabase/types";

type AdminSupabase = ReturnType<typeof createAdminClient>;
type Account = Database["public"]["Tables"]["accounts"]["Row"];

export type MarketProfileSummary = { account: string; generated: boolean; skipped?: "user_edited"; error?: string };

// Shared between the monthly cron (see /api/cron/industry-trends, which
// triggers both this and industry trends together — same input, same
// cadence) and Regenerate (see /api/market-profile/regenerate).
//
// Reads the account's own most recent industry_trends and company_research
// rather than researching from scratch: generateMarketProfile is a
// synthesis over already-vetted material, not a duplicate research pass
// (see its own comment in anthropic.ts for why that matters).
export async function runMarketProfileForAccount(
  supabase: AdminSupabase,
  account: Account,
  competitorNames: string[],
  options: { skipIfUserEdited?: boolean } = {}
): Promise<MarketProfileSummary> {
  if (options.skipIfUserEdited) {
    const { data: existing } = await supabase
      .from("market_profile")
      .select("user_edited_at")
      .eq("account_id", account.id)
      .maybeSingle();
    if (existing?.user_edited_at) return { account: account.name, generated: false, skipped: "user_edited" };
  }

  try {
    const { data: trendsRow } = await supabase
      .from("industry_trends")
      .select("trends")
      .eq("account_id", account.id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const result = await generateMarketProfile(
      { companyName: account.name, positioning: account.positioning, icp: account.icp },
      competitorNames,
      (trendsRow?.trends ?? []) as IndustryTrendItem[],
      account.company_research,
      account.id
    );

    const { error } = await supabase.from("market_profile").upsert(
      {
        account_id: account.id,
        market_name: result.marketName,
        market_description: result.marketDescription,
        maturity: result.maturity,
        growth_direction: result.growthDirection,
        growth_reason: result.growthReason,
        dynamics: result.dynamics,
        product_summary: result.productSummary,
        generated_at: new Date().toISOString(),
        user_edited_at: null,
      },
      { onConflict: "account_id" }
    );

    return { account: account.name, generated: !error, error: error?.message };
  } catch (err) {
    console.error(`market profile generation failed for ${account.name}:`, err);
    return { account: account.name, generated: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Self-heal for an account with no market_profile row yet, same pattern
// and reasoning as ensureIndustryTrends: without this, a new account's
// first profile only appears whenever the monthly cron next happens to
// fire, possibly weeks away. Fires at most once — the existence check is
// what keeps every later crawl from re-triggering it.
export async function ensureMarketProfile(
  supabase: AdminSupabase,
  account: Account,
  competitorNames: string[]
): Promise<void> {
  const { data: existing } = await supabase
    .from("market_profile")
    .select("id")
    .eq("account_id", account.id)
    .limit(1)
    .maybeSingle();
  if (existing) return;

  await runMarketProfileForAccount(supabase, account, competitorNames);
}
