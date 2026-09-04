import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { SupabaseNotConfigured } from "@/components/admin/not-configured";
import { AccountAdminView } from "@/components/admin/account-admin-view";
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

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
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
