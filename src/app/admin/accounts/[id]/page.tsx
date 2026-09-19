import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { SupabaseNotConfigured } from "@/components/admin/not-configured";
import { AccountAdminView } from "@/components/admin/account-admin-view";
import { AccountActivityCard, type ActivityUser, type AdoptionItem } from "@/components/admin/account-activity-card";
import { daysAgoIso, relativeTime, summarizeActivity, type ActivityRow } from "@/lib/activity";
import { sumLlmUsageByFunction } from "@/lib/llm-pricing";

export const dynamic = "force-dynamic";

const LLM_USAGE_LOOKBACK_DAYS = 90;

export default async function AdminAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-10">
        <SupabaseNotConfigured />
      </div>
    );
  }

  const supabase = createAdminClient();

  const { data: account } = await supabase.from("accounts").select("*").eq("id", id).single();
  if (!account) notFound();

  // Same "Account #N" rank shown in the list (oldest = 1) — a count of
  // accounts created at or before this one is cheaper than fetching every
  // account just to find this one's position.
  const { count: accountNumber } = await supabase
    .from("accounts")
    .select("id", { count: "exact", head: true })
    .lte("created_at", account.created_at);

  const { data: competitors } = await supabase
    .from("competitors")
    .select("*")
    .eq("account_id", id)
    .order("created_at", { ascending: true });

  const competitorIds = (competitors ?? []).map((c) => c.id);
  const { data: signals } = competitorIds.length
    ? await supabase
        .from("signals")
        .select("*")
        .in("competitor_id", competitorIds)
        .order("occurred_on", { ascending: false })
    : { data: [] };

  // "Last crawled" per competitor — competitor_pricing/competitor_hiring are
  // the two current-state snapshot tables every crawl unconditionally
  // touches, regardless of whether anything actually changed (see their own
  // migration comments), so the more recent of the two last_checked_at
  // values is a true "was this competitor actually crawled recently"
  // signal. signals.occurred_on isn't used for this: a signal only exists
  // when a diff was detected, so a competitor with nothing new to report
  // would wrongly look stale even on a crawl that ran an hour ago.
  const [{ data: pricingChecks }, { data: hiringChecks }] = competitorIds.length
    ? await Promise.all([
        supabase.from("competitor_pricing").select("competitor_id, last_checked_at").in("competitor_id", competitorIds),
        supabase.from("competitor_hiring").select("competitor_id, last_checked_at").in("competitor_id", competitorIds),
      ])
    : [{ data: [] }, { data: [] }];

  const lastCrawledByCompetitor: Record<string, string | null> = {};
  for (const row of [...(pricingChecks ?? []), ...(hiringChecks ?? [])]) {
    const existing = lastCrawledByCompetitor[row.competitor_id];
    if (!existing || new Date(row.last_checked_at) > new Date(existing)) {
      lastCrawledByCompetitor[row.competitor_id] = row.last_checked_at;
    }
  }
  const lastCrawledOverall = Object.values(lastCrawledByCompetitor).reduce<string | null>(
    (latest, ts) => (ts && (!latest || new Date(ts) > new Date(latest)) ? ts : latest),
    null
  );

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - LLM_USAGE_LOOKBACK_DAYS);
  const { data: usageRows } = await supabase
    .from("llm_usage")
    .select(
      "account_id, function_name, model, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, created_at"
    )
    .eq("account_id", id)
    .gte("created_at", since.toISOString());

  const llmUsageByFunction = Array.from(sumLlmUsageByFunction(usageRows ?? []).entries())
    .map(([functionName, totals]) => ({ functionName, ...totals }))
    .sort((a, b) => b.costUsd - a.costUsd);
  const llmUsageTotalUsd = llmUsageByFunction.reduce((sum, row) => sum + row.costUsd, 0);

  // Activity: who's on the account, when they signed up / last signed in /
  // how often, which pages they open, and which product areas they've set up.
  const ACTIVITY_WINDOW_DAYS = 30;
  const activitySince = daysAgoIso(ACTIVITY_WINDOW_DAYS);
  const [
    { data: profileRows },
    { data: activityRows },
    { data: loginRows },
    { count: winLossCount },
    { data: apiKeys },
    { data: integrations },
    { data: invites },
    { count: documentCount },
  ] = await Promise.all([
    supabase.from("profiles").select("id, role").eq("account_id", id),
    supabase
      .from("user_activity")
      .select("user_id, kind, path, created_at")
      .eq("account_id", id)
      .gte("created_at", activitySince)
      .limit(20_000),
    supabase.from("user_activity").select("user_id").eq("account_id", id).eq("kind", "login").limit(20_000),
    supabase.from("competitor_win_loss").select("id", { count: "exact", head: true }).eq("account_id", id),
    supabase.from("api_keys").select("last_used_at").eq("account_id", id).is("revoked_at", null),
    supabase.from("integrations").select("provider, connected").eq("account_id", id),
    supabase.from("invites").select("accepted_at").eq("account_id", id),
    supabase.from("account_documents").select("id", { count: "exact", head: true }).eq("account_id", id),
  ]);

  const activityByUser = summarizeActivity((activityRows ?? []) as ActivityRow[]);
  const loginCounts = new Map<string, number>();
  for (const r of loginRows ?? []) loginCounts.set(r.user_id, (loginCounts.get(r.user_id) ?? 0) + 1);

  const activityUsers: ActivityUser[] = await Promise.all(
    (profileRows ?? []).map(async (p) => {
      const { data } = await supabase.auth.admin.getUserById(p.id);
      const a = activityByUser.get(p.id);
      return {
        id: p.id,
        email: data.user?.email ?? "–",
        role: p.role,
        signedUpAt: data.user?.created_at ?? null,
        lastLoginAt: data.user?.last_sign_in_at ?? null,
        loginCount: loginCounts.get(p.id) ?? 0,
        lastActiveAt: a?.lastActiveAt ?? null,
        features: a?.features ?? {},
      };
    })
  );
  const featureTotals: Record<string, number> = {};
  for (const u of activityUsers) {
    for (const [label, n] of Object.entries(u.features)) featureTotals[label] = (featureTotals[label] ?? 0) + n;
  }

  const connected = (integrations ?? []).filter((i) => i.connected).map((i) => i.provider);
  const lastKeyUse = (apiKeys ?? []).reduce<string | null>(
    (latest, k) => (k.last_used_at && (!latest || k.last_used_at > latest) ? k.last_used_at : latest),
    null
  );
  const acceptedInvites = (invites ?? []).filter((i) => i.accepted_at).length;
  const adoption: AdoptionItem[] = [
    { label: "Competitors tracked", detail: String(competitors?.length ?? 0), used: (competitors?.length ?? 0) > 0 },
    { label: "Win/loss logged", detail: String(winLossCount ?? 0), used: (winLossCount ?? 0) > 0 },
    {
      label: "Integrations connected",
      detail: connected.length > 0 ? connected.join(", ") : "none",
      used: connected.length > 0,
    },
    {
      label: "API keys",
      detail: (apiKeys?.length ?? 0) > 0 ? `${apiKeys!.length} active, last used ${relativeTime(lastKeyUse)}` : "none",
      used: (apiKeys?.length ?? 0) > 0,
    },
    {
      label: "Teammates invited",
      detail: `${invites?.length ?? 0} sent, ${acceptedInvites} accepted`,
      used: (invites?.length ?? 0) > 0,
    },
    { label: "Positioning docs uploaded", detail: String(documentCount ?? 0), used: (documentCount ?? 0) > 0 },
    {
      label: "Ask (AI questions)",
      detail: llmUsageByFunction.some((f) => f.functionName === "answerQuestion") ? "used" : "not yet",
      used: llmUsageByFunction.some((f) => f.functionName === "answerQuestion"),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <AccountActivityCard
        users={activityUsers}
        adoption={adoption}
        featureTotals={featureTotals}
        windowDays={ACTIVITY_WINDOW_DAYS}
      />
      <AccountAdminView
        account={account}
        accountNumber={accountNumber ?? undefined}
        competitors={competitors ?? []}
        signals={signals ?? []}
        lastCrawledByCompetitor={lastCrawledByCompetitor}
        lastCrawledOverall={lastCrawledOverall}
        llmUsageByFunction={llmUsageByFunction}
        llmUsageTotalUsd={llmUsageTotalUsd}
        llmUsageWindowDays={LLM_USAGE_LOOKBACK_DAYS}
      />
    </div>
  );
}
