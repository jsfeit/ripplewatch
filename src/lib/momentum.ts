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
function countDelta(recentCount: number, priorCount: number): number | null {
  const total = recentCount + priorCount;
  if (total === 0) return null;
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

  const components: MomentumResult["components"] = {
    hiring: {
      label: "Hiring",
      score: countDelta(hiringRecent, hiringPrior),
      recentCount: hiringRecent,
      priorCount: hiringPrior,
    },
    pricing: {
      label: "Pricing activity",
      score: countDelta(pricingRecent, pricingPrior),
      recentCount: pricingRecent,
      priorCount: pricingPrior,
    },
    pressAndFunding: {
      label: "Press & funding",
      score: countDelta(pressRecent, pressPrior),
      recentCount: pressRecent,
      priorCount: pressPrior,
    },
    relevanceTrend: {
      label: "Relevance trend",
      score: relevanceTrendScore,
      recentCount: scoredRecent.length,
      priorCount: scoredPrior.length,
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
