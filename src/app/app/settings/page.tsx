import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountContext } from "@/lib/impersonation";
import { computeMomentum, type MomentumResult } from "@/lib/momentum";
import { SettingsView } from "./settings-view";
import { FeedbackButton } from "@/components/app/feedback-button";

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

  // account/competitors/integrations/suggestions/apiKeys/referrals only
  // depend on accountId, not on each other — previously fetched one at a
  // time, which meant paying every round trip's latency in serial on every
  // Settings page load. Batched the same way dashboard/page.tsx already
  // does, since Supabase has no way to bundle unrelated table reads into
  // one request itself.
  const [
    { data: account },
    { data: competitors },
    { data: integrations },
    { data: suggestions },
    { data: apiKeys },
    { data: referrals },
  ] = await Promise.all([
    db
      .from("accounts")
      .select(
        "id, tier, status, subscription_status, contact_email, demo_mode, referral_code, slack_digest_day, slack_digest_hour, stripe_customer_id, stripe_subscription_id, timezone"
      )
      .eq("id", accountId)
      .single(),
    db
      .from("competitors")
      .select("id, name, domain, category, github_repo, created_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: true }),
    db.from("integrations").select("provider, connected").eq("account_id", accountId),
    db
      .from("suggested_competitors")
      .select("id, name, category, reasoning")
      .eq("account_id", accountId)
      .eq("status", "pending")
      .order("discovered_at", { ascending: false }),
    // Never selects key_hash — the plaintext key is shown once at creation
    // and this list only ever needs the prefix/metadata to render.
    db
      .from("api_keys")
      .select("id, name, key_prefix, last_used_at, revoked_at, created_at")
      .eq("account_id", accountId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
    db
      .from("referrals")
      .select("id, referred_account_id, referred_at, qualified_at")
      .eq("referrer_account_id", accountId)
      .order("referred_at", { ascending: false }),
  ]);
  if (!account) redirect("/onboarding");

  // Same momentum sort the competitor list already offers on its own
  // fact-sheet page (see /app/competitors/[id]) — kept for parity now that
  // the list itself lives here. 180-day lookback (not just the 60
  // days the recent/prior comparison itself needs) so computeMomentum's
  // per-competitor reliability weighting has real history to judge from —
  // see computeReliability in momentum.ts.
  const competitorIds = (competitors ?? []).map((c) => c.id);
  const reliabilityLookbackStart = new Date();
  reliabilityLookbackStart.setUTCDate(reliabilityLookbackStart.getUTCDate() - 180);
  const [
    { data: recentSignals },
    { data: momentumSignals },
    { data: momentumWinLoss },
    { data: momentumStateHistory },
  ] = competitorIds.length
    ? await Promise.all([
        db
          .from("signals")
          .select("id, competitor_id, scored, relevance_level, relevance_reasoning, title")
          .in("competitor_id", competitorIds)
          .order("occurred_on", { ascending: false })
          .limit(10),
        db
          .from("signals")
          .select("competitor_id, type, sentiment, occurred_on, scored, relevance_score")
          .in("competitor_id", competitorIds)
          .gte("occurred_on", reliabilityLookbackStart.toISOString().slice(0, 10)),
        db.from("competitor_win_loss").select("competitor_id, outcome, created_at").in("competitor_id", competitorIds),
        db
          .from("competitor_state_history")
          .select("competitor_id, metric, value, recorded_at")
          .in("competitor_id", competitorIds)
          .gte("recorded_at", reliabilityLookbackStart.toISOString()),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const momentumByCompetitorId: Record<string, MomentumResult> = {};
  for (const c of competitors ?? []) {
    momentumByCompetitorId[c.id] = computeMomentum(
      (momentumSignals ?? []).filter((s) => s.competitor_id === c.id),
      (momentumWinLoss ?? []).filter((e) => e.competitor_id === c.id),
      (momentumStateHistory ?? []).filter((e) => e.competitor_id === c.id)
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-10 sm:py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your tracked competitors, integrations, your team, and your plan.
          </p>
        </div>
        <FeedbackButton />
      </div>
      <SettingsView
        account={account}
        competitors={competitors ?? []}
        suggestions={suggestions ?? []}
        momentum={momentumByCompetitorId}
        integrations={integrations ?? []}
        recentSignals={recentSignals ?? []}
        apiKeys={apiKeys ?? []}
        referrals={referrals ?? []}
        currentUserId={user.id}
      />
    </div>
  );
}
