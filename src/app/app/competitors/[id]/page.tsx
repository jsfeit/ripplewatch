import { notFound, redirect } from "next/navigation";
import { Globe } from "lucide-react";
import { cn, avatarColor } from "@/lib/utils";
import { CompetitorManager } from "@/components/app/competitor-manager";
import { SuggestedCompetitorsPanel } from "@/components/app/suggested-competitors-panel";
import { CompetitorMonitoringUrls } from "@/components/app/competitor-monitoring-urls";
import { CompetitorFactSheet } from "@/components/app/competitor-fact-sheet";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountContext } from "@/lib/impersonation";
import { computeMomentum, type MomentumResult } from "@/lib/momentum";
import { detectGoneQuiet, type GoneQuietResult } from "@/lib/gone-quiet";

export const dynamic = "force-dynamic";

export default async function CompetitorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { accountId, db } = await resolveAccountContext(supabase, user.id);
  if (!accountId) redirect("/onboarding");

  // account/competitors/suggestions/hubspotIntegration/marketProfile only
  // need accountId, and winLoss only needs the route's id — none of the six
  // depend on each other, so they no longer pay their round-trip latency
  // one at a time.
  const [
    { data: account },
    { data: competitors },
    { data: suggestions },
    { data: winLoss },
    { data: hubspotIntegration },
    { data: marketProfile },
  ] = await Promise.all([
    db.from("accounts").select("name, tier, has_sales_crm, has_plg").eq("id", accountId).single(),
    // NOTE: pricing_fetch_failures/pricing_last_failed_at/
    // careers_fetch_failures/careers_last_failed_at (migration 0059) are
    // deliberately NOT selected here even though CompetitorMonitoringUrls
    // has props for them — that migration was never actually applied to
    // production (confirmed directly against the live DB while narrowing
    // this select), so those columns don't exist there yet. select("*")
    // was silently omitting them before too; this just makes that explicit
    // instead of accidentally erroring the whole query once real column
    // names are specified. Add them back here once migration 0059 ships.
    db
      .from("competitors")
      .select(
        "id, name, domain, category, github_repo, created_at, pricing_url, careers_url, fact_sheet_why_we_win, fact_sheet_why_we_lose, fact_sheet_generated_at"
      )
      .eq("account_id", accountId)
      .order("created_at", { ascending: true }),
    db
      .from("suggested_competitors")
      .select("id, name, category, reasoning")
      .eq("account_id", accountId)
      .eq("status", "pending")
      .order("discovered_at", { ascending: false }),
    db
      .from("competitor_win_loss")
      .select("id, outcome, reason, created_at")
      .eq("competitor_id", id)
      .order("created_at", { ascending: false }),
    db
      .from("integrations")
      .select("connected")
      .eq("account_id", accountId)
      .eq("provider", "hubspot")
      .eq("connected", true)
      .maybeSingle(),
    db.from("market_profile").select("growth_direction").eq("account_id", accountId).maybeSingle(),
  ]);
  if (!account) redirect("/onboarding");

  const competitor = (competitors ?? []).find((c) => c.id === id);
  if (!competitor) notFound();

  // Same computeMomentum used on Trends, surfaced here too so it's
  // visible on the page people actually click into a competitor from.
  // 180-day lookback (not just the 60 days the recent/prior comparison
  // itself needs) so computeMomentum's per-competitor reliability
  // weighting has real history to judge from — see computeReliability in
  // momentum.ts.
  const competitorIds = (competitors ?? []).map((c) => c.id);
  const reliabilityLookbackStart = new Date();
  reliabilityLookbackStart.setUTCDate(reliabilityLookbackStart.getUTCDate() - 180);
  const [{ data: momentumSignals }, { data: momentumWinLoss }, { data: momentumStateHistory }] = competitorIds.length
    ? await Promise.all([
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
    : [{ data: [] }, { data: [] }, { data: [] }];
  const momentumByCompetitorId: Record<string, MomentumResult> = {};
  for (const c of competitors ?? []) {
    momentumByCompetitorId[c.id] = computeMomentum(
      (momentumSignals ?? []).filter((s) => s.competitor_id === c.id),
      (momentumWinLoss ?? []).filter((e) => e.competitor_id === c.id),
      (momentumStateHistory ?? []).filter((e) => e.competitor_id === c.id)
    );
  }

  // Same detection as the dashboard's Momentum section (see gone-quiet.ts)
  // — kept in sync deliberately: a competitor that reads "Gone quiet" on
  // the dashboard should read the same way here, not a different label
  // just because this page computes momentum independently.
  const goneQuietByCompetitorId: Record<string, GoneQuietResult | null> = {};
  for (const c of competitors ?? []) {
    goneQuietByCompetitorId[c.id] = detectGoneQuiet({
      competitorId: c.id,
      competitorCreatedAt: c.created_at,
      allSignals: momentumSignals ?? [],
      peerCompetitorIds: competitorIds,
      marketGrowthDirection: marketProfile?.growth_direction ?? null,
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-10 sm:py-10">
      <div className="mb-6 print:hidden">
        <h1 className="text-2xl font-semibold tracking-tight">Competitors &amp; Comparison</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track who you&apos;re up against, then compare yourself to one of them at a time below.
        </p>
      </div>

      <div className="print:hidden">
        <CompetitorManager
          competitors={competitors ?? []}
          tier={account.tier}
          activeId={id}
          momentum={momentumByCompetitorId}
          goneQuiet={goneQuietByCompetitorId}
        />
      </div>

      <div className="mt-6 flex items-center gap-3 print:hidden">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-full text-sm font-semibold",
            avatarColor(competitor.name)
          )}
        >
          {competitor.name.charAt(0).toUpperCase()}
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{competitor.name}</h1>
          {competitor.domain ? (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Globe className="size-3.5" />
              {competitor.domain}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-border p-4 print:hidden">
        <h2 className="text-sm font-semibold text-muted-foreground">Monitoring sources</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Where we check for pricing and hiring changes. Pre-filled with a best guess from the domain: correct
          them if we guessed wrong, or a competitor uses a different path.
        </p>
        <div className="mt-3">
          <CompetitorMonitoringUrls
            competitorId={competitor.id}
            domain={competitor.domain}
            initialPricingUrl={competitor.pricing_url}
            initialCareersUrl={competitor.careers_url}
            // These four columns (migration 0059) aren't selected above
            // because they don't exist on production yet — see the select's
            // own comment. 0/null here matches what was actually happening
            // before this select was narrowed (select("*") already silently
            // returned undefined for these, which behaved as "no known
            // failures" wherever UrlHealthWarning compares against a
            // threshold) — not a behavior change, just made honest instead
            // of a silent type mismatch.
            pricingFetchFailures={0}
            pricingLastFailedAt={null}
            careersFetchFailures={0}
            careersLastFailedAt={null}
          />
        </div>
      </div>

      {/* Scroll target for the "View fact sheet" deep link on the Competitors
          list, and the only section left visible when printing this page. */}
      <div id="fact-sheet">
        <CompetitorFactSheet
          competitorId={competitor.id}
          competitorName={competitor.name}
          accountName={account.name}
          hubspotConnected={Boolean(hubspotIntegration)}
          // Legacy accounts that predate this question on both false: keep
          // showing win/loss (the original, only option) rather than
          // hiding data-collection entirely.
          showWinLoss={account.has_sales_crm || !account.has_plg}
          showChurn={account.has_plg}
          initialWhyWeWin={competitor.fact_sheet_why_we_win}
          initialWhyWeLose={competitor.fact_sheet_why_we_lose}
          initialGeneratedAt={competitor.fact_sheet_generated_at}
          initialWinLoss={winLoss ?? []}
        />
      </div>

      <div className="mt-8 print:hidden">
        <SuggestedCompetitorsPanel suggestions={suggestions ?? []} />
      </div>
    </div>
  );
}
