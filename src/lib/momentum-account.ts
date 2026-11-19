import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { computeMomentum, type MomentumResult } from "@/lib/momentum";
import { activityRead, type ActivityRead } from "@/lib/activity-read";
import { computePriorities, type WatchPriority } from "@/lib/watch-priority";
import { loadAllDeals, withDealDate } from "@/lib/deal-store";
import { loadMarketContext } from "@/lib/market-context";
import { computeCompetitorCosts, type CompetitorCost } from "@/lib/competitor-cost";
import { sourceCoverage, coverageSummary, type CoverageSource } from "@/lib/source-coverage";
import { detectGoneQuiet } from "@/lib/gone-quiet";
import { computeStrengthRead, type StrengthRead } from "@/lib/strength-read";

type Admin = SupabaseClient<Database>;

export type CompetitorMomentum = {
  competitor: { id: string; name: string };
  momentum: MomentumResult;
  activity: ActivityRead;
  priority: WatchPriority;
  // What this competitor is costing the company, from its own deals. Null headline until a deal names them.
  cost: CompetitorCost;
  // Which sources feed the read and what to add for the ones that do not.
  coverage: { sources: CoverageSource[]; summary: string | null };
  // Set when Cooling or Gone quiet: a cautious way to read the silence as an opening, never as a certainty.
  opportunity: string | null;
  // The direction behind the volume: strength or weakness signs from hiring mix, pricing, reviews and buzz.
  strength: StrengthRead;
};

const OPPORTUNITY =
  "Quieter than usual. That can be an opening: their customers may be easier to reach, and it is a good moment to press where you are strongest. It can also mean they are building something, so treat it as a window to check, not a conclusion.";

// One place that knows how to load the inputs computeMomentum needs and run
// it per competitor, shared by the REST momentum route, the win/loss route's
// "did this shift the score" payoff, and the MCP tools — so the three can't
// drift apart on the lookback window or which tables feed the score.
//
// Deterministic, no LLM cost. 180-day lookback (not just the 60 days the
// recent/prior comparison itself needs) so computeMomentum's per-competitor
// reliability weighting has real history to judge from — see
// computeReliability in momentum.ts.
export async function loadCompetitorMomentum(
  supabase: Admin,
  accountId: string,
  opts: { competitorId?: string } = {}
): Promise<CompetitorMomentum[]> {
  let competitorQuery = supabase
    .from("competitors")
    .select("id, name, created_at, pricing_url, careers_url, github_repo, g2_url, capterra_url, trustpilot_url, appstore_id")
    .eq("account_id", accountId);
  if (opts.competitorId) competitorQuery = competitorQuery.eq("id", opts.competitorId);
  const { data: competitors } = await competitorQuery;
  const list = competitors ?? [];
  if (list.length === 0) return [];
  const competitorIds = list.map((c) => c.id);

  const lookbackStart = new Date();
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - 180);

  const [{ data: signals }, { data: winLoss }, { data: stateHistory }, { data: hiringRows }, { data: buzzRows }] = await Promise.all([
    supabase
      .from("signals")
      .select("competitor_id, type, title, sentiment, occurred_on, scored, relevance_score")
      .in("competitor_id", competitorIds)
      .gte("occurred_on", lookbackStart.toISOString().slice(0, 10)),
    loadAllDeals(supabase, accountId).then((rows) => ({ data: withDealDate(rows).filter((r) => r.competitor_id && competitorIds.includes(r.competitor_id)) })),
    supabase
      .from("competitor_state_history")
      .select("competitor_id, metric, value, recorded_at")
      .in("competitor_id", competitorIds)
      .gte("recorded_at", lookbackStart.toISOString()),
    supabase.from("competitor_hiring").select("competitor_id, department_breakdown").in("competitor_id", competitorIds),
    supabase.from("competitor_buzz").select("competitor_id, sentiment_summary").in("competitor_id", competitorIds),
  ]);

  // Industry developments: they count toward a competitor's priority (a regulator targeting its product category), and
  // the market's direction decides whether a quiet competitor is flagged as gone quiet.
  const market = await loadMarketContext(supabase, accountId).catch(() => null);

  const reads = list.map((c) => {
    const mine = (signals ?? []).filter((s) => s.competitor_id === c.id);
    const history = (stateHistory ?? []).filter((e) => e.competitor_id === c.id);
    const deals = (winLoss ?? []).filter((e) => e.competitor_id === c.id);
    const computed = computeMomentum(mine, deals, history);
    // The dashboard and the weekly digest already apply this override; applying it here keeps the assistant from
    // contradicting them about the same competitor.
    const quiet = detectGoneQuiet({
      competitorId: c.id,
      competitorCreatedAt: c.created_at,
      allSignals: signals ?? [],
      peerCompetitorIds: competitorIds,
      marketGrowthDirection: market?.market?.direction ?? null,
    });
    const momentum: MomentumResult = quiet ? { ...computed, score: null, label: "Gone quiet" } : computed;
    const sources = sourceCoverage(c, history, mine);
    const readings = (metric: string) => history.filter((e) => e.metric === metric).map((e) => ({ value: e.value, recorded_at: e.recorded_at }));
    const strength = computeStrengthRead({
      hiring: hiringRows?.find((h) => h.competitor_id === c.id)?.department_breakdown ?? null,
      peerHiring: (hiringRows ?? []).filter((h) => h.competitor_id !== c.id).map((h) => h.department_breakdown ?? {}),
      priceReadings: readings("lowest_price"),
      ratingReadings: readings("review_rating"),
      buzzSummary: buzzRows?.find((b) => b.competitor_id === c.id)?.sentiment_summary ?? null,
    });
    return {
      competitor: { id: c.id, name: c.name },
      mine,
      deals,
      momentum,
      // What is knowable before there is a trend: shown only while Momentum says "Not enough history yet".
      activity: activityRead(mine, history, new Date(), c.created_at),
      coverage: { sources, summary: coverageSummary(sources) },
      opportunity: momentum.label === "Gone quiet" || momentum.label === "Cooling" ? OPPORTUNITY : null,
      strength,
    };
  });

  // Priority and cost are relative to the other competitors tracked, so both are computed across the whole set.
  const trendsFor = (name: string) =>
    (market?.trends ?? []).filter((t) => t.competitors.some((c) => c.trim().toLowerCase() === name.trim().toLowerCase())).map((t) => t.title);
  const priorities = computePriorities(
    reads.map((r) => ({ id: r.competitor.id, signals: r.mine, deals: r.deals, baseline: r.activity.baseline, marketTrends: trendsFor(r.competitor.name) }))
  );
  const costs = computeCompetitorCosts(competitorIds, winLoss ?? []);
  return reads.map((r) => ({
    competitor: r.competitor,
    momentum: r.momentum,
    activity: r.activity,
    priority: priorities.get(r.competitor.id)!,
    cost: costs.get(r.competitor.id)!,
    coverage: r.coverage,
    opportunity: r.opportunity,
    strength: r.strength,
  }));
}
