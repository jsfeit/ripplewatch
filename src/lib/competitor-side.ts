import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { readCompanyWebsite } from "@/lib/company-overview";

type Admin = SupabaseClient<Database>;
type Competitor = Database["public"]["Tables"]["competitors"]["Row"];

// For an account that sells to both businesses and consumers, works out which side a competitor
// competes on, from the competitor's own website. Nothing in setup asks for it. The customer can
// correct it from the Competitors tab. Runs once per competitor: an unclear or unreadable site is
// recorded as "both", which means it counts for either side, so it is not retried on every crawl.
export async function classifyCompetitorSide(supabase: Admin, competitor: Competitor): Promise<void> {
  if (competitor.sells_to !== null || !competitor.domain) return;
  const { data: account } = await supabase.from("accounts").select("sells_to").eq("id", competitor.account_id).single();
  if (account?.sells_to !== "both") return;

  let side: "business" | "consumer" | "both" = "both";
  try {
    const read = await readCompanyWebsite(competitor.name, competitor.domain, competitor.account_id);
    if (read && !read.sellsToUnsure) side = read.sellsTo;
  } catch (err) {
    console.error(`classifyCompetitorSide failed for ${competitor.name}:`, err);
  }
  await supabase.from("competitors").update({ sells_to: side }).eq("id", competitor.id).is("sells_to", null);
}
