import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TIER_SIGNAL_SOURCES } from "@/lib/tier-limits";
import { KeyMetricsBoard } from "./key-metrics-board";

export const metadata = { title: "Key metrics" };
export const dynamic = "force-dynamic";

export default async function KeyMetricsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();
  if (!profile?.account_id) redirect("/onboarding");

  const { data: account } = await supabase
    .from("accounts")
    .select("tier")
    .eq("id", profile.account_id)
    .single();
  const tier = account?.tier ?? "starter";
  const seoAllowed = TIER_SIGNAL_SOURCES[tier].includes("seo");

  const { data: competitors } = await supabase
    .from("competitors")
    .select("*")
    .eq("account_id", profile.account_id)
    .order("created_at", { ascending: true });

  const competitorIds = (competitors ?? []).map((c) => c.id);

  const { data: seo } =
    seoAllowed && competitorIds.length
      ? await supabase.from("competitor_seo").select("*").in("competitor_id", competitorIds)
      : { data: [] };

  // Most recent seo-type signal per competitor, so cards can show "last
  // changed" the same way PricingCard does — a real diff, not just the
  // routine snapshot refresh.
  const { data: seoSignals } =
    seoAllowed && competitorIds.length
      ? await supabase
          .from("signals")
          .select("*")
          .in("competitor_id", competitorIds)
          .eq("type", "seo")
          .order("created_at", { ascending: false })
      : { data: [] };

  // Momentum is available to every tier — it's built entirely from data
  // every account already has (hiring, pricing, press/funding, relevance
  // scoring), unlike the SEO/traffic card below which stays Plus/Advanced.
  // 60 days back covers both the "recent" and "prior" comparison windows
  // computeMomentum needs; occurred_on (not created_at) so this reflects
  // when things actually happened, same convention as signal-freshness.ts.
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 60);
  const { data: momentumSignals } = competitorIds.length
    ? await supabase
        .from("signals")
        .select("competitor_id, type, occurred_on, scored, relevance_score")
        .in("competitor_id", competitorIds)
        .gte("occurred_on", sixtyDaysAgo.toISOString().slice(0, 10))
    : { data: [] };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-10 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Key metrics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Momentum — hiring, pricing activity, press/funding, and relevance trend — plus estimated organic traffic
          per competitor.
        </p>
      </div>
      <KeyMetricsBoard
        competitors={competitors ?? []}
        momentumSignals={momentumSignals ?? []}
        seoAllowed={seoAllowed}
        seo={seo ?? []}
        seoSignals={seoSignals ?? []}
      />
    </div>
  );
}
