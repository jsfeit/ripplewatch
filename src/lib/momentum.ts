import type { Database } from "@/lib/supabase/types";

type Signal = Pick<
  Database["public"]["Tables"]["signals"]["Row"],
  "type" | "occurred_on" | "scored" | "relevance_score" | "sentiment"
>;

type WinLossEntry = Pick<Database["public"]["Tables"]["competitor_win_loss"]["Row"], "outcome" | "created_at">;

// Real-valued state readings (open role count, entry-tier price) recorded
// once per crawl by checkJobPostingsDiff/checkPricingStructure in
// scraping.ts. Lets hiring/pricing measure actual magnitude of change
// ("added 40 roles" vs "added 1") instead of just counting how many
// discrete signal events fired — optional and defaults to empty so every
// existing caller keeps working unchanged; hiring/pricing fall back to the
// count-delta method below wherever it isn't passed, or hasn't accumulated
// enough history yet.
export type StateHistoryEntry = Pick<
  Database["public"]["Tables"]["competitor_state_history"]["Row"],
  "metric" | "value" | "recorded_at"
>;

// win/loss entries have no real deal-close date, only created_at (when it
// was logged) — a bulk CSV import lands every historical row on the same
// day, which would break a calendar-window comparison the same way an
// empty prior-window baseline did for the other components (see
// countDelta). Ordering by created_at and splitting into an older/newer
// half sidesteps that: it works the same whether the data arrived as one
// big backfill or trickled in one deal at a time via the API/email path.
const MIN_WIN_LOSS_ENTRIES = 4;

// Rolls up what Ripplewatch already tracks for free — hiring velocity,
// pricing activity, product-change activity, press/funding activity, how
// the model's own relevance scoring is trending, and win rate — into one
// directional number, rather than making someone eyeball six separate
// trend chips and do the mental math themselves. Deliberately excludes
// SEO/traffic: that source is still a stub (see seo-data.ts) and only
// available Plus/Advanced, so folding it in would make momentum meaningless
// for Starter accounts and wrong for everyone until real data lands.
const WINDOW_DAYS = 30;
const HEATING_UP_THRESHOLD = 15;
const COOLING_THRESHOLD = -15;

// The number of components computeMomentum can ever populate — used as the
// LOW_CONFIDENCE_THRESHOLD cutoff for the confidence flag, and as the
// equal-weight fallback denominator when every component's reliability
// weight comes back zero (see the score computation below).
const TOTAL_COMPONENTS = 6;

// Press/funding sentiment is weighted by recency (not a flat window
// average) so a big story right when it breaks dominates the score, then
// fades — the number of days for a signal's weight to halve. 7 days means
// something from today counts ~2x a week-old story and ~16x a month-old
// one, so a real spike is felt immediately and washes out on its own
// rather than lingering at full weight until it falls out of the 30-day
// window entirely.
const NEWS_DECAY_HALF_LIFE_DAYS = 7;

// How far back reliability weighting looks to judge how consistently each
// component actually has real data for a given competitor — see
// computeReliability below. 6 buckets of WINDOW_DAYS each = 180 days.
// Callers that only pass ~60 days of signals (most of them today, see
// StateHistoryEntry's doc comment) still work: reliability just degrades
// gracefully to however many of the 6 buckets their input actually covers,
// rather than requiring every caller to be rewired at once.
const RELIABILITY_LOOKBACK_BUCKETS = 6;

export type MomentumLabel = "Heating up" | "Steady" | "Cooling" | "Not enough history yet";

export type MomentumComponent = {
  label: string;
  score: number | null;
  recentCount: number;
  priorCount: number;
  // Pre-formatted so every consumer (dashboard UI, weekly digest email)
  // renders the same text without reimplementing the "what do these two
  // numbers mean" logic per component. Most components are raw
  // signal-volume counts, so "X vs Y" reads naturally; relevanceTrend's
  // recentCount/priorCount are just how many signals got scored in each
  // window, not a measure of relevance itself, so it needs its own wording
  // (average score, not signal count) or it silently misleads.
  detail: string;
  // How much this component actually moved the final score, 0-1 — the
  // reliability weight described below, surfaced so the UI can show *why*
  // one competitor's win-rate swing barely moved their score while
  // another's did (this competitor logs win/loss consistently, that one
  // rarely does).
  weight: number;
};

// Below this many populated components (out of the 6 computeMomentum can
// ever populate), the averaged score is one or two
// signals doing all the work — real, but fragile enough that a UI showing
// it should say so rather than presenting it with the same confidence as a
// fully-populated score.
const LOW_CONFIDENCE_THRESHOLD = 4;

export type MomentumConfidence = "low" | "full";

export type MomentumResult = {
  score: number | null;
  label: MomentumLabel;
  // "low" when fewer than LOW_CONFIDENCE_THRESHOLD of the 6 components have
  // real data — surfaced in the UI so a score built from one thin signal
  // doesn't read with the same weight as one built from all six.
  confidence: MomentumConfidence;
  components: {
    hiring: MomentumComponent;
    pricing: MomentumComponent;
    productChange: MomentumComponent;
    pressAndFunding: MomentumComponent;
    relevanceTrend: MomentumComponent;
    winRate: MomentumComponent;
  };
};

// Bounded, symmetric "how much did this move" index: 0 when nothing
// changed, approaches +/-100 as activity swings entirely to one window.
// The +2 smoothing keeps a lone signal (1 vs 0) from immediately maxing
// out the score the way a plain percentage-change would.
//
// Requires at least one signal in BOTH windows, not just total > 0. A
// zero-count prior window isn't evidence the competitor went quiet — for
// an account that's only been tracking a competitor for a few weeks, the
// prior 30-60-days-ago window is often sparse simply because backfill
// coverage doesn't reach that far back yet, not because nothing happened.
// Without this guard, "9 recent vs 0 prior" scores as a ~+82 spike purely
// from an empty baseline, which is indistinguishable from real momentum
// in the UI and was producing implausible, clustered "Heating up" labels
// across newly-tracked competitors. relevanceTrend already had an
// equivalent guard (both window lengths must be > 0); this brings the
// other components in line with it.
function countDelta(recentCount: number, priorCount: number): number | null {
  if (recentCount === 0 || priorCount === 0) return null;
  const total = recentCount + priorCount;
  const raw = (100 * (recentCount - priorCount)) / (total + 2);
  return Math.max(-100, Math.min(100, raw));
}

// Same shape as countDelta but for a real-valued reading (open role count,
// entry-tier price) instead of a signal-event count — a symmetric
// percentage-of-magnitude change, bounded to +/-100, with the same +2
// smoothing so a small absolute move (e.g. 1 role vs 0) doesn't swing to
// the extreme. Zero-vs-zero (a competitor with no open roles in both
// windows) correctly scores 0, not undefined — "no change" is exactly
// right there, unlike countDelta's zero-baseline guard, which exists to
// avoid mistaking sparse backfill coverage for a real spike; a state
// reading of 0 is an actual observed value, not a data gap.
function valueDelta(recentValue: number, priorValue: number): number {
  const raw = (100 * (recentValue - priorValue)) / (Math.abs(recentValue) + Math.abs(priorValue) + 2);
  return Math.max(-100, Math.min(100, raw));
}

function inWindow(occurredOn: string, start: Date, end: Date): boolean {
  const d = new Date(occurredOn);
  return d >= start && d < end;
}

// Latest reading within a window — "where do they stand right now," not an
// average across however many times they happened to get crawled that
// month. Returns null when the window has no reading at all, which the
// caller treats as "not enough state history yet, fall back to counting
// signal events."
function latestValueInWindow(entries: StateHistoryEntry[], metric: string, start: Date, end: Date): number | null {
  const inRange = entries
    .filter((e) => e.metric === metric && inWindow(e.recorded_at, start, end))
    .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
  return inRange.length > 0 ? inRange[0].value : null;
}

function sentimentWeight(sentiment: Signal["sentiment"]): number {
  if (sentiment === "positive") return 1;
  if (sentiment === "negative") return -1;
  return 0; // neutral, or unclassified (older signals predating sentiment tagging)
}

// Recency-weighted sentiment average: each signal's contribution decays
// by how many days old it is (relative to now), so a story from
// yesterday counts far more than one from three weeks ago even though
// both sit in the same "recent" window. Falls back to 0 (neutral) only
// if every signal passed in somehow has zero weight, which in practice
// can't happen for a non-empty list since weight is always > 0.
function decayWeightedSentiment(signals: Signal[], now: Date): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const signal of signals) {
    const daysAgo = (now.getTime() - new Date(signal.occurred_on).getTime()) / (24 * 60 * 60 * 1000);
    const weight = Math.pow(0.5, Math.max(0, daysAgo) / NEWS_DECAY_HALF_LIFE_DAYS);
    weightedSum += sentimentWeight(signal.sentiment) * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

// Measures whether press/funding coverage is trending more favorable or
// more unfavorable for the competitor between the two windows — not just
// whether there's more or less of it. Pure volume ("8 stories this month
// vs 2 last month") reads as "heating up" regardless of whether that
// coverage is a funding round or a lawsuit; a recency-weighted average of
// sentiment per signal and comparing the two windows' averages answers
// "is this good or bad news for them, and how fresh is it" instead. Same
// zero-baseline guard as countDelta: requires at least one signal in both
// windows, since an empty prior window says nothing about sentiment either.
function sentimentDelta(recent: Signal[], prior: Signal[], now: Date): number | null {
  if (recent.length === 0 || prior.length === 0) return null;
  const avgRecent = decayWeightedSentiment(recent, now);
  const avgPrior = decayWeightedSentiment(prior, now);
  return Math.max(-100, Math.min(100, (avgRecent - avgPrior) * 100));
}

// "3 positive, 1 negative" — omits a sentiment bucket entirely when it's
// zero, and falls back to a plain count when everything in the window is
// neutral/unclassified, so the detail text never reads as padded with
// zeroes.
function describeSentimentMix(signals: Signal[]): string {
  const positive = signals.filter((s) => s.sentiment === "positive").length;
  const negative = signals.filter((s) => s.sentiment === "negative").length;
  const parts: string[] = [];
  if (positive > 0) parts.push(`${positive} positive`);
  if (negative > 0) parts.push(`${negative} negative`);
  if (parts.length === 0) return `${signals.length} neutral`;
  return parts.join(", ");
}

function winRate(entries: WinLossEntry[]): number {
  return avg(entries.map((e) => (e.outcome === "won" ? 1 : 0)));
}

// Older/newer split by logged order, not calendar time — see the type
// comment above for why. Requires MIN_WIN_LOSS_ENTRIES total before
// splitting at all; below that, a 1-vs-1 comparison is too noisy to mean
// anything (one flipped outcome would swing from +100 to -100).
function winRateDelta(sortedEntries: WinLossEntry[]): number | null {
  if (sortedEntries.length < MIN_WIN_LOSS_ENTRIES) return null;
  const mid = Math.floor(sortedEntries.length / 2);
  const older = sortedEntries.slice(0, mid);
  const newer = sortedEntries.slice(mid);
  return Math.max(-100, Math.min(100, (winRate(newer) - winRate(older)) * 100));
}

// "3W-1L vs 1W-2L" — same "why is this the score it is" framing as the
// other components' detail text.
function describeWinLossMix(entries: WinLossEntry[]): string {
  const won = entries.filter((e) => e.outcome === "won").length;
  const lost = entries.filter((e) => e.outcome === "lost").length;
  return `${won}W-${lost}L`;
}

// How consistently a component has had real data for THIS competitor,
//0-1 — the basis for dynamic, per-competitor importance weighting (a
// competitor who logs win/loss every week should have win-rate trend
// actually move their score; one who's never had a single entry shouldn't
// have its absence penalize them the same as a competitor who normally
// reports it but happens to be quiet this period). Walks backward from now
// in WINDOW_DAYS-wide buckets and checks whether `hasData` finds anything
// in each one, so it's just "fraction of the last N periods with at least
// one real reading" — deliberately simple over something like a decayed
// average, since this needs to be legible if a customer asks "why did my
// win-rate swing barely move the score."
function computeReliability(now: Date, hasData: (start: Date, end: Date) => boolean): number {
  let populated = 0;
  for (let i = 0; i < RELIABILITY_LOOKBACK_BUCKETS; i++) {
    const end = new Date(now);
    end.setUTCDate(end.getUTCDate() - i * WINDOW_DAYS);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - WINDOW_DAYS);
    if (hasData(start, end)) populated++;
  }
  return populated / RELIABILITY_LOOKBACK_BUCKETS;
}

export function computeMomentum(
  signals: Signal[],
  winLossEntries: WinLossEntry[] = [],
  stateHistory: StateHistoryEntry[] = []
): MomentumResult {
  const now = new Date();
  const recentStart = new Date(now);
  recentStart.setUTCDate(recentStart.getUTCDate() - WINDOW_DAYS);
  const priorStart = new Date(now);
  priorStart.setUTCDate(priorStart.getUTCDate() - WINDOW_DAYS * 2);

  const recent = signals.filter((s) => inWindow(s.occurred_on, recentStart, now));
  const prior = signals.filter((s) => inWindow(s.occurred_on, priorStart, recentStart));

  const hiringRecentSignals = recent.filter((s) => s.type === "job_posting").length;
  const hiringPriorSignals = prior.filter((s) => s.type === "job_posting").length;

  const pricingRecentSignals = recent.filter((s) => s.type === "pricing").length;
  const pricingPriorSignals = prior.filter((s) => s.type === "pricing").length;

  const productChangeRecent = recent.filter((s) => s.type === "product_change").length;
  const productChangePrior = prior.filter((s) => s.type === "product_change").length;

  const pressRecentSignals = recent.filter((s) => s.type === "news" || s.type === "funding");
  const pressPriorSignals = prior.filter((s) => s.type === "news" || s.type === "funding");

  const sortedWinLoss = [...winLossEntries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const winRateScore = winRateDelta(sortedWinLoss);
  const winLossMid = Math.floor(sortedWinLoss.length / 2);
  const winLossOlder = sortedWinLoss.slice(0, winLossMid);
  const winLossNewer = sortedWinLoss.slice(winLossMid);

  const scoredRecent = recent.filter((s) => s.scored && s.relevance_score !== null);
  const scoredPrior = prior.filter((s) => s.scored && s.relevance_score !== null);
  const relevanceTrendScore =
    scoredRecent.length > 0 && scoredPrior.length > 0
      ? Math.max(
          -100,
          Math.min(
            100,
            avg(scoredRecent.map((s) => s.relevance_score!)) - avg(scoredPrior.map((s) => s.relevance_score!))
          )
        )
      : null;

  const countDetail = (score: number | null, recentCount: number, priorCount: number) =>
    score === null ? "no data" : `${recentCount} vs ${priorCount} last period`;

  // Hiring/pricing prefer the real magnitude of change (open role count,
  // entry-tier price) from state history when there's a reading in both
  // windows; otherwise fall back to counting how many discrete signal
  // events fired, same as before this component existed. This means a
  // competitor tracked since before state history started accumulating
  // keeps working exactly as it did, and switches to magnitude mode on its
  // own the first time both windows have a real reading — no migration or
  // backfill required.
  const hiringRecentValue = latestValueInWindow(stateHistory, "open_role_count", recentStart, now);
  const hiringPriorValue = latestValueInWindow(stateHistory, "open_role_count", priorStart, recentStart);
  const hiringUsesMagnitude = hiringRecentValue !== null && hiringPriorValue !== null;
  const hiringScore = hiringUsesMagnitude
    ? valueDelta(hiringRecentValue!, hiringPriorValue!)
    : countDelta(hiringRecentSignals, hiringPriorSignals);

  const pricingRecentValue = latestValueInWindow(stateHistory, "lowest_price", recentStart, now);
  const pricingPriorValue = latestValueInWindow(stateHistory, "lowest_price", priorStart, recentStart);
  const pricingUsesMagnitude = pricingRecentValue !== null && pricingPriorValue !== null;
  const pricingScore = pricingUsesMagnitude
    ? valueDelta(pricingRecentValue!, pricingPriorValue!)
    : countDelta(pricingRecentSignals, pricingPriorSignals);

  const productChangeScore = countDelta(productChangeRecent, productChangePrior);
  const pressScore = sentimentDelta(pressRecentSignals, pressPriorSignals, now);
  const relevanceRecentAvg = scoredRecent.length > 0 ? Math.round(avg(scoredRecent.map((s) => s.relevance_score!))) : null;
  const relevancePriorAvg = scoredPrior.length > 0 ? Math.round(avg(scoredPrior.map((s) => s.relevance_score!))) : null;

  // Reliability weight per component — see computeReliability's doc
  // comment. Hiring/pricing check state-history presence when running in
  // magnitude mode (that's the data actually driving their score), and
  // signal presence otherwise, so the weight always reflects the source
  // the score itself is built from.
  const hiringWeight = computeReliability(now, (start, end) =>
    hiringUsesMagnitude
      ? stateHistory.some((e) => e.metric === "open_role_count" && inWindow(e.recorded_at, start, end))
      : signals.some((s) => s.type === "job_posting" && inWindow(s.occurred_on, start, end))
  );
  const pricingWeight = computeReliability(now, (start, end) =>
    pricingUsesMagnitude
      ? stateHistory.some((e) => e.metric === "lowest_price" && inWindow(e.recorded_at, start, end))
      : signals.some((s) => s.type === "pricing" && inWindow(s.occurred_on, start, end))
  );
  const productChangeWeight = computeReliability(now, (start, end) =>
    signals.some((s) => s.type === "product_change" && inWindow(s.occurred_on, start, end))
  );
  const pressWeight = computeReliability(now, (start, end) =>
    signals.some((s) => (s.type === "news" || s.type === "funding") && inWindow(s.occurred_on, start, end))
  );
  const relevanceWeight = computeReliability(now, (start, end) =>
    signals.some((s) => s.scored && s.relevance_score !== null && inWindow(s.occurred_on, start, end))
  );
  const winRateWeight = computeReliability(now, (start, end) =>
    winLossEntries.some((e) => inWindow(e.created_at, start, end))
  );

  const components: MomentumResult["components"] = {
    hiring: {
      label: "Hiring",
      score: hiringScore,
      recentCount: hiringUsesMagnitude ? hiringRecentValue! : hiringRecentSignals,
      priorCount: hiringUsesMagnitude ? hiringPriorValue! : hiringPriorSignals,
      detail: hiringScore === null
        ? "no data"
        : hiringUsesMagnitude
          ? `${hiringRecentValue} open roles vs ${hiringPriorValue} last period`
          : countDetail(hiringScore, hiringRecentSignals, hiringPriorSignals),
      weight: hiringWeight,
    },
    pricing: {
      label: "Pricing activity",
      score: pricingScore,
      recentCount: pricingUsesMagnitude ? pricingRecentValue! : pricingRecentSignals,
      priorCount: pricingUsesMagnitude ? pricingPriorValue! : pricingPriorSignals,
      detail: pricingScore === null
        ? "no data"
        : pricingUsesMagnitude
          ? `entry tier $${pricingRecentValue} vs $${pricingPriorValue} last period`
          : countDetail(pricingScore, pricingRecentSignals, pricingPriorSignals),
      weight: pricingWeight,
    },
    productChange: {
      label: "Product changes",
      score: productChangeScore,
      recentCount: productChangeRecent,
      priorCount: productChangePrior,
      detail: countDetail(productChangeScore, productChangeRecent, productChangePrior),
      weight: productChangeWeight,
    },
    pressAndFunding: {
      label: "Press & funding",
      score: pressScore,
      recentCount: pressRecentSignals.length,
      priorCount: pressPriorSignals.length,
      detail:
        pressScore === null
          ? "no data"
          : `${describeSentimentMix(pressRecentSignals)} vs ${describeSentimentMix(pressPriorSignals)} last period`,
      weight: pressWeight,
    },
    relevanceTrend: {
      label: "Relevance trend",
      score: relevanceTrendScore,
      recentCount: scoredRecent.length,
      priorCount: scoredPrior.length,
      detail:
        relevanceTrendScore === null
          ? "no data"
          : `avg ${relevanceRecentAvg} vs ${relevancePriorAvg} last period`,
      weight: relevanceWeight,
    },
    winRate: {
      label: "Win rate trend",
      score: winRateScore,
      recentCount: winLossNewer.length,
      priorCount: winLossOlder.length,
      detail:
        winRateScore === null
          ? sortedWinLoss.length === 0
            ? "no data, log a win/loss to include this"
            : `${sortedWinLoss.length} logged, need ${MIN_WIN_LOSS_ENTRIES} to include this`
          : `${describeWinLossMix(winLossNewer)} recently vs ${describeWinLossMix(winLossOlder)} earlier`,
      weight: winRateWeight,
    },
  };

  const present = Object.values(components).filter((c): c is MomentumComponent & { score: number } => c.score !== null);
  const confidence: MomentumConfidence = present.length >= LOW_CONFIDENCE_THRESHOLD ? "full" : "low";
  if (present.length === 0) {
    return { score: null, label: "Not enough history yet", confidence, components };
  }

  // Weighted average by reliability instead of a flat 1/6 each: a
  // component that's normally dense for this competitor still shrinks the
  // score toward zero when it's unexpectedly missing this period (its
  // weight counts in the denominator either way), but a component that's
  // always sparse for this competitor barely shrinks anything when it's
  // absent, since it was never expected to be reliable in the first place.
  // Falls back to a plain equal-weight average of whatever's present (the
  // pre-weighting behavior) on the edge case where every component's
  // reliability comes back zero — a brand-new competitor whose first-ever
  // signals happen to land inside this call's own recent/prior windows
  // rather than in a prior reliability bucket.
  const totalWeight = Object.values(components).reduce((sum, c) => sum + c.weight, 0);
  const score =
    totalWeight > 0
      ? present.reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight
      : present.reduce((sum, c) => sum + c.score, 0) / TOTAL_COMPONENTS;
  const label: MomentumLabel =
    score >= HEATING_UP_THRESHOLD ? "Heating up" : score <= COOLING_THRESHOLD ? "Cooling" : "Steady";

  return { score: Math.round(score), label, confidence, components };
}

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// Shared between the Trends cards and the Competitors list badge so
// the two never drift into different colors/wording for the same label.
export const MOMENTUM_STYLES: Record<MomentumLabel, string> = {
  "Heating up": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Steady: "bg-secondary text-muted-foreground",
  Cooling: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  "Not enough history yet": "bg-secondary text-muted-foreground",
};
