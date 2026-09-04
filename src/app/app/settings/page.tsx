import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountContext } from "@/lib/impersonation";
import { computeMomentum, type MomentumResult } from "@/lib/momentum";
import { TIER_SIGNAL_SOURCES, effectiveTier } from "@/lib/tier-limits";
import { SettingsView } from "./settings-view";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Uses resolveAccountContext (not a plain profiles.account_id lookup) so
  // an admin's "View as" session shows the impersonated account's own
  // Settings instead of the admin's own — this page previously ignored
  // impersonation entirely and always rendered the real logged-in user's
  // account, which is what made demo_mode invisible during a View as
  // session even with the flag correctly set on the target account.
  const { accountId, db } = await resolveAccountContext(supabase, user.id);
  if (!accountId) redirect("/onboarding");

  const { data: account } = await db
    .from("accounts")
    .select("*")
    .eq("id", accountId)
    .single();
  if (!account) redirect("/onboarding");

  const { data: competitors } = await db
    .from("competitors")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });

  const { data: integrations } = await db
    .from("integrations")
    .select("*")
    .eq("account_id", accountId);

  const competitorIds = (competitors ?? []).map((c) => c.id);
  const { data: recentSignals } = competitorIds.length
    ? await db
        .from("signals")
        .select("*")
        .in("competitor_id", competitorIds)
        .order("occurred_on", { ascending: false })
        .limit(10)
    : { data: [] };

  const { data: suggestions } = await db
    .from("suggested_competitors")
    .select("*")
    .eq("account_id", accountId)
    .eq("status", "pending")
    .order("discovered_at", { ascending: false });

  // Same momentum/traffic sort the competitor list already offers on its
  // own fact-sheet page (see /app/competitors/[id]) — kept for parity now
  // that the list itself lives here. 180-day lookback (not just the 60
  // days the recent/prior comparison itself needs) so computeMomentum's
  // per-competitor reliability weighting has real history to judge from —
  // see computeReliability in momentum.ts.
  const reliabilityLookbackStart = new Date();
  reliabilityLookbackStart.setUTCDate(reliabilityLookbackStart.getUTCDate() - 180);
  const { data: momentumSignals } = competitorIds.length
    ? await db
        .from("signals")
        .select("competitor_id, type, sentiment, occurred_on, scored, relevance_score")
        .in("competitor_id", competitorIds)
        .gte("occurred_on", reliabilityLookbackStart.toISOString().slice(0, 10))
    : { data: [] };
  const { data: momentumWinLoss } = competitorIds.length
    ? await db
        .from("competitor_win_loss")
        .select("competitor_id, outcome, created_at")
        .in("competitor_id", competitorIds)
    : { data: [] };
  const { data: momentumStateHistory } = competitorIds.length
    ? await db
        .from("competitor_state_history")
        .select("competitor_id, metric, value, recorded_at")
        .in("competitor_id", competitorIds)
        .gte("recorded_at", reliabilityLookbackStart.toISOString())
    : { data: [] };
  const momentumByCompetitorId: Record<string, MomentumResult> = {};
  for (const c of competitors ?? []) {
    momentumByCompetitorId[c.id] = computeMomentum(
      (momentumSignals ?? []).filter((s) => s.competitor_id === c.id),
      (momentumWinLoss ?? []).filter((e) => e.competitor_id === c.id),
      (momentumStateHistory ?? []).filter((e) => e.competitor_id === c.id)
    );
  }

  const seoAllowed = TIER_SIGNAL_SOURCES[effectiveTier(account.tier, account.demo_mode)].includes("seo");
  const { data: seo } =
    seoAllowed && competitorIds.length
      ? await db
          .from("competitor_seo")
          .select("competitor_id, organic_traffic_estimate")
          .in("competitor_id", competitorIds)
      : { data: [] };
  const trafficByCompetitorId = Object.fromEntries(
    (seo ?? []).map((s) => [s.competitor_id, s.organic_traffic_estimate])
  );

  // Never selects key_hash — the plaintext key is shown once at creation
  // and this list only ever needs the prefix/metadata to render.
  const { data: apiKeys } = await db
    .from("api_keys")
    .select("id, name, key_prefix, last_used_at, revoked_at, created_at")
    .eq("account_id", accountId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  const { data: referrals } = await db
    .from("referrals")
    .select("id, referred_account_id, referred_at, qualified_at")
    .eq("referrer_account_id", accountId)
    .order("referred_at", { ascending: false });

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
        referrals={referrals ?? []}
        currentUserId={user.id}
      />
    </div>
  );
}
