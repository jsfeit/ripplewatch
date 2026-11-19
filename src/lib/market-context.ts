import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, IndustryTrendItem, MarketGrowthDirection } from "@/lib/supabase/types";

type Admin = SupabaseClient<Database>;

// Industry-level developments that can move competitors: a regulator's rule, a shift in how buyers behave, a change in
// the technology the category rests on. Ripplewatch already researches these per account (the Industry Pulse), naming
// which tracked competitors each one touches. This puts them where the assistant and the card can use them, so an answer
// about a competitor can say "and this is happening around them" instead of only describing the competitor itself.
export type MarketContext = {
  market: { name: string; direction: MarketGrowthDirection; reason: string } | null;
  trends: { category: string; title: string; description: string; competitors: string[]; source: string | null }[];
  asOf: string | null;
};

const DIRECTION_WORDS: Record<MarketGrowthDirection, string> = { heating_up: "heating up", steady: "steady", cooling: "cooling" };
export const describeDirection = (d: MarketGrowthDirection) => DIRECTION_WORDS[d];

export function shapeTrends(items: IndustryTrendItem[], limit = 4): MarketContext["trends"] {
  return items.slice(0, limit).map((t) => ({
    category: t.category,
    title: t.title,
    description: t.description,
    competitors: t.relatedCompetitors ?? [],
    source: t.source?.name ?? null,
  }));
}

export async function loadMarketContext(supabase: Admin, accountId: string): Promise<MarketContext> {
  const [{ data: trendRow }, { data: profile }] = await Promise.all([
    supabase.from("industry_trends").select("trends, generated_at").eq("account_id", accountId).order("generated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("market_profile").select("market_name, growth_direction, growth_reason").eq("account_id", accountId).maybeSingle(),
  ]);
  return {
    market: profile ? { name: profile.market_name, direction: profile.growth_direction, reason: profile.growth_reason } : null,
    trends: shapeTrends((trendRow?.trends as IndustryTrendItem[] | undefined) ?? []),
    asOf: trendRow?.generated_at ?? null,
  };
}

// Said once, for both tools, so the assistant treats these the same way everywhere.
export const MARKET_NOTE =
  "Industry developments researched for this account, with the tracked competitors each one touches. Mention the ones that name a competitor you are discussing, say they are market context and not something that competitor did, and give the source name. They are refreshed about monthly, so say as_of if asked how current they are.";
