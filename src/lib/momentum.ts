import type { Database } from "@/lib/supabase/types";

type Signal = Pick<
  Database["public"]["Tables"]["signals"]["Row"],
  "type" | "occurred_on" | "scored" | "relevance_score" | "sentiment"
>;

type WinLossEntry = Pick<Database["public"]["Tables"]["competitor_win_loss"]["Row"], "outcome" | "created_at">;

// win/loss entries have no real deal-close date, only created_at (when it
// was logged) — a bulk CSV import lands every historical row on the same
// day, which would break a calendar-window comparison the same way an
// empty prior-window baseline did for the other components (see
// countDelta). Ordering by created_at and splitting into an older/newer
// half sidesteps that: it works the same whether the data arrived as one
// big backfill or trickled in one deal at a time via the API/email path.
const MIN_WIN_LOSS_ENTRIES = 4;

// Rolls up four things Ripplewatch already tracks for free — hiring
// velocity, pricing activity, press/funding activity, and how the model's
// own relevance scoring is trending — into one directional number, rather
// than making someone eyeball four separate trend chips and do the mental
// math themselves. Deliberately excludes SEO/traffic: that source is still
// a stub (see seo-data.ts) and only available Plus/Advanced, so folding it
// in would make momentum meaningless for Starter accounts and wrong for
// everyone until real data lands.
const WINDOW_DAYS = 30;
const HEATING_UP_THRESHOLD = 15;
const COOLING_THRESHOLD = -15;

export type MomentumLabel = "Heating up" | "Steady" | "Cooling" | "Not enough history yet";

export type MomentumComponent = {
  label: string;
  score: number | null;
  recentCount: number;
  priorCount: number;
  // Pre-formatted so every consumer (dashboard UI, weekly digest email)
  // renders the same text without reimplementing the "what do these two
  // numbers mean" logic per component. Hiring/pricing/press are raw
  // signal-volume counts, so "X vs Y" reads naturally; relevanceTrend's
  // recentCount/priorCount are just how many signals got scored in each
  // window, not a measure of relevance itself, so it needs its own wording
  // (average score, not signal count) or it silently misleads.
  detail: string;
};

// Below this many populated components (out of the 5 computeMomentum can
// ever populate), the averaged score is one or two
// signals doing all the work — real, but fragile enough that a UI showing
// it should say so rather than presenting it with the same confidence as a
// fully-populated score.
const LOW_CONFIDENCE_THRESHOLD = 3;

export type MomentumConfidence = "low" | "full";

export type MomentumResult = {
  score: number | null;
  label: MomentumLabel;
  // "low" when fewer than LOW_CONFIDENCE_THRESHOLD of the 5 components have
  // real data — surfaced in the UI so a score built from one thin signal
  // doesn't read with the same weight as one built from all five.
  confidence: MomentumConfidence;
  components: {
    hiring: MomentumComponent;
    pricing: MomentumComponent;
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
// other three components in line with it.
function countDelta(recentCount: number, priorCount: number): number | null {
  if (recentCount === 0 || priorCount === 0) return null;
  const total = recentCount + priorCount;
  const raw = (100 * (recentCount - priorCount)) / (total + 2);
  return Math.max(-100, Math.min(100, raw));
}

function inWindow(occurredOn: string, start: Date, end: Date): boolean {
  const d = new Date(occurredOn);
  return d >= start && d < end;
}

function sentimentWeight(sentiment: Signal["sentiment"]): number {
  if (sentiment === "positive") return 1;
  if (sentiment === "negative") return -1;
  return 0; // neutral, or unclassified (older signals predating sentiment tagging)
}

// Measures whether press/funding coverage is trending more favorable or
// more unfavorable for the competitor between the two windows — not just
// whether there's more or less of it. Pure volume ("8 stories this month
// vs 2 last month") reads as "heating up" regardless of whether that
// coverage is a funding round or a lawsuit; averaging sentiment per
// signal and comparing the two windows' averages answers "is this good or
// bad news for them" instead. Same zero-baseline guard as countDelta:
// requires at least one signal in both windows, since an empty prior
// window says nothing about sentiment either.
function sentimentDelta(recent: Signal[], prior: Signal[]): number | null {
  if (recent.length === 0 || prior.length === 0) return null;
  const avgRecent = avg(recent.map((s) => sentimentWeight(s.sentiment)));
  const avgPrior = avg(prior.map((s) => sentimentWeight(s.sentiment)));
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

export function computeMomentum(signals: Signal[], winLossEntries: WinLossEntry[] = []): MomentumResult {
  const now = new Date();
  const recentStart = new Date(now);
  recentStart.setUTCDate(recentStart.getUTCDate() - WINDOW_DAYS);
  const priorStart = new Date(now);
  priorStart.setUTCDate(priorStart.getUTCDate() - WINDOW_DAYS * 2);

  const recent = signals.filter((s) => inWindow(s.occurred_on, recentStart, now));
  const prior = signals.filter((s) => inWindow(s.occurred_on, priorStart, recentStart));

  const hiringRecent = recent.filter((s) => s.type === "job_posting").length;
  const hiringPrior = prior.filter((s) => s.type === "job_posting").length;

  const pricingRecent = recent.filter((s) => s.type === "pricing").length;
  const pricingPrior = prior.filter((s) => s.type === "pricing").length;

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

  const hiringScore = countDelta(hiringRecent, hiringPrior);
  const pricingScore = countDelta(pricingRecent, pricingPrior);
  const pressScore = sentimentDelta(pressRecentSignals, pressPriorSignals);
  const relevanceRecentAvg = scoredRecent.length > 0 ? Math.round(avg(scoredRecent.map((s) => s.relevance_score!))) : null;
  const relevancePriorAvg = scoredPrior.length > 0 ? Math.round(avg(scoredPrior.map((s) => s.relevance_score!))) : null;

  const components: MomentumResult["components"] = {
    hiring: {
      label: "Hiring",
      score: hiringScore,
      recentCount: hiringRecent,
      priorCount: hiringPrior,
      detail: countDetail(hiringScore, hiringRecent, hiringPrior),
    },
    pricing: {
      label: "Pricing activity",
      score: pricingScore,
      recentCount: pricingRecent,
      priorCount: pricingPrior,
      detail: countDetail(pricingScore, pricingRecent, pricingPrior),
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
    },
  };

  const present = Object.values(components).filter((c): c is MomentumComponent & { score: number } => c.score !== null);
  const confidence: MomentumConfidence = present.length >= LOW_CONFIDENCE_THRESHOLD ? "full" : "low";
  if (present.length === 0) {
    return { score: null, label: "Not enough history yet", confidence, components };
  }

  const score = avg(present.map((c) => c.score));
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
