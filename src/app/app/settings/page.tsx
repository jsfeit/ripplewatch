import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeMomentum, type MomentumResult } from "@/lib/momentum";
import { TIER_SIGNAL_SOURCES } from "@/lib/tier-limits";
import { SettingsView } from "./settings-view";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
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
    .select("*")
    .eq("id", profile.account_id)
    .single();
  if (!account) redirect("/onboarding");

  const { data: competitors } = await supabase
    .from("competitors")
    .select("*")
    .eq("account_id", profile.account_id)
    .order("created_at", { ascending: true });

  const { data: integrations } = await supabase
    .from("integrations")
    .select("*")
    .eq("account_id", profile.account_id);

  const competitorIds = (competitors ?? []).map((c) => c.id);
  const { data: recentSignals } = competitorIds.length
    ? await supabase
        .from("signals")
        .select("*")
        .in("competitor_id", competitorIds)
        .order("occurred_on", { ascending: false })
        .limit(10)
    : { data: [] };

  const { data: suggestions } = await supabase
    .from("suggested_competitors")
    .select("*")
    .eq("account_id", profile.account_id)
    .eq("status", "pending")
    .order("discovered_at", { ascending: false });

  // Same momentum/traffic sort the competitor list already offers on its
  // own fact-sheet page (see /app/competitors/[id]) — kept for parity now
  // that the list itself lives here.
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 60);
  const { data: momentumSignals } = competitorIds.length
    ? await supabase
        .from("signals")
        .select("competitor_id, type, occurred_on, scored, relevance_score")
        .in("competitor_id", competitorIds)
        .gte("occurred_on", sixtyDaysAgo.toISOString().slice(0, 10))
    : { data: [] };
  const momentumByCompetitorId: Record<string, MomentumResult> = {};
  for (const c of competitors ?? []) {
    momentumByCompetitorId[c.id] = computeMomentum(
      (momentumSignals ?? []).filter((s) => s.competitor_id === c.id)
    );
  }

  const seoAllowed = TIER_SIGNAL_SOURCES[account.tier].includes("seo");
  const { data: seo } =
    seoAllowed && competitorIds.length
      ? await supabase
          .from("competitor_seo")
          .select("competitor_id, organic_traffic_estimate")
          .in("competitor_id", competitorIds)
      : { data: [] };
  const trafficByCompetitorId = Object.fromEntries(
    (seo ?? []).map((s) => [s.competitor_id, s.organic_traffic_estimate])
  );

  // Never selects key_hash — the plaintext key is shown once at creation
  // and this list only ever needs the prefix/metadata to render.
  const { data: apiKeys } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, last_used_at, revoked_at, created_at")
    .eq("account_id", profile.account_id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-10 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your tracked competitors, integrations, your team, and your plan.
        </p>
      </div>
      <SettingsView
        account={account}
        competitors={competitors ?? []}
        suggestions={suggestions ?? []}
        momentum={momentumByCompetitorId}
        traffic={trafficByCompetitorId}
        seoAllowed={seoAllowed}
        integrations={integrations ?? []}
        recentSignals={recentSignals ?? []}
        apiKeys={apiKeys ?? []}
        currentUserId={user.id}
      />
    </div>
  );
}
