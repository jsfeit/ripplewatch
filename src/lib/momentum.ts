import type { Database } from "@/lib/supabase/types";

type Signal = Pick<
  Database["public"]["Tables"]["signals"]["Row"],
  "type" | "occurred_on" | "scored" | "relevance_score"
>;

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

export type MomentumResult = {
  score: number | null;
  label: MomentumLabel;
  components: {
    hiring: MomentumComponent;
    pricing: MomentumComponent;
    pressAndFunding: MomentumComponent;
    relevanceTrend: MomentumComponent;
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

export function computeMomentum(signals: Signal[]): MomentumResult {
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

  const pressRecent = recent.filter((s) => s.type === "news" || s.type === "funding").length;
  const pressPrior = prior.filter((s) => s.type === "news" || s.type === "funding").length;

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
  const pressScore = countDelta(pressRecent, pressPrior);
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
      recentCount: pressRecent,
      priorCount: pressPrior,
      detail: countDetail(pressScore, pressRecent, pressPrior),
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
  };

  const present = Object.values(components).filter((c): c is MomentumComponent & { score: number } => c.score !== null);
  if (present.length === 0) {
    return { score: null, label: "Not enough history yet", components };
  }

  const score = avg(present.map((c) => c.score));
  const label: MomentumLabel =
    score >= HEATING_UP_THRESHOLD ? "Heating up" : score <= COOLING_THRESHOLD ? "Cooling" : "Steady";

  return { score: Math.round(score), label, components };
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
