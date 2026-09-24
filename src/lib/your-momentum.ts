import { summarizeNps, NPS_WINDOW_DAYS, type FeedbackEntry } from "@/lib/customer-voice";
import type { MomentumLabel, MomentumConfidence } from "@/lib/momentum";
import type { WinLossOutcome } from "@/lib/supabase/types";

// Momentum is inherently per-competitor — it scores THEIR activity, so
// customer voice (which is about the account's own customers) can't just
// become another component bolted onto an existing competitor's score.
// This is the honest way to fold it in instead: a parallel "Your
// Momentum" reading, same visual vocabulary (MomentumLabel,
// MOMENTUM_STYLES, MomentumMeter) as competitor Momentum, built from
// account-level inputs — NPS trend and account-wide win-rate trend —
// rather than a competitor's signals. Sits next to competitor Momentum on
// the dashboard so "how are they doing" and "how are we doing" read as one
// consistent concept instead of two unrelated systems.

const HEATING_UP_THRESHOLD = 15;
const COOLING_THRESHOLD = -15;

// How many recent NPS responses this needs before trusting the NPS-trend
// component at full strength — same reasoning as momentum.ts's own
// sentiment-delta dampening: a single response swinging the recent average
// shouldn't move the score as hard as several corroborating ones would.
const MIN_RECENT_NPS_FOR_FULL_CONFIDENCE = 3;

// Win/loss entries have no real deal-close date, only created_at — same
// reasoning and same threshold as momentum.ts's own MIN_WIN_LOSS_ENTRIES:
// below this many total entries, an older/newer split is too noisy to mean
// anything (one flipped outcome could swing from +100 to -100).
const MIN_WIN_LOSS_ENTRIES = 4;

export type YourMomentumComponent = {
  label: string;
  score: number | null;
  detail: string;
  wellSupported: boolean;
};

export type YourMomentumResult = {
  score: number | null;
  label: MomentumLabel;
  confidence: MomentumConfidence;
  components: {
    npsTrend: YourMomentumComponent;
    winRateTrend: YourMomentumComponent;
  };
};

type WinLossEntry = { outcome: WinLossOutcome; created_at: string };

function winRate(entries: WinLossEntry[]): number {
  if (entries.length === 0) return 0;
  return entries.filter((e) => e.outcome === "won").length / entries.length;
}

function describeWinLossMix(entries: WinLossEntry[]): string {
  const won = entries.filter((e) => e.outcome === "won").length;
  const lost = entries.length - won;
  return `${won}W-${lost}L`;
}

// feedbackEntries: every scored customer-feedback entry for the account
// (account_customer_feedback rows with a score — see customer-voice.ts's
// FeedbackEntry). winLossEntries: EVERY win/loss entry for the account,
// attributed or not — this is account-wide, unlike a single competitor's
// own Momentum, so it isn't scoped to one competitor_id.
export function computeYourMomentum(
  feedbackEntries: FeedbackEntry[],
  winLossEntries: WinLossEntry[]
): YourMomentumResult {
  const nps = summarizeNps(feedbackEntries);

  let npsScore: number | null = null;
  let npsDetail = "no data, log or import an NPS score to include this";
  let npsWellSupported = false;
  if (nps.recentScore !== null) {
    const confidence = Math.min(1, nps.recentCount / MIN_RECENT_NPS_FOR_FULL_CONFIDENCE);
    npsWellSupported = nps.recentCount >= MIN_RECENT_NPS_FOR_FULL_CONFIDENCE;
    if (nps.priorScore !== null) {
      const raw = nps.recentScore - nps.priorScore;
      npsScore = Math.max(-100, Math.min(100, raw * confidence));
      npsDetail = `NPS ${nps.recentScore} vs ${nps.priorScore} last period`;
    } else {
      // A recent score with nothing to compare against isn't a trend yet —
      // real signal, but not a directional move, so it stays out of the
      // score the same way momentum.ts's own components return null
      // rather than guess at a direction with no baseline.
      npsDetail = `NPS ${nps.recentScore}, no prior period to compare yet`;
    }
  }

  const sorted = [...winLossEntries].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  let winRateScore: number | null = null;
  let winRateDetail = "no data, log a win/loss to include this";
  let winRateWellSupported = false;
  if (sorted.length >= MIN_WIN_LOSS_ENTRIES) {
    const mid = Math.floor(sorted.length / 2);
    const older = sorted.slice(0, mid);
    const newer = sorted.slice(mid);
    winRateScore = Math.max(-100, Math.min(100, (winRate(newer) - winRate(older)) * 100));
    winRateDetail = `${describeWinLossMix(newer)} recently vs ${describeWinLossMix(older)} earlier`;
    winRateWellSupported = true;
  } else if (sorted.length > 0) {
    winRateDetail = `${sorted.length} logged, need ${MIN_WIN_LOSS_ENTRIES} to include this`;
  }

  const components: YourMomentumResult["components"] = {
    npsTrend: { label: "NPS trend", score: npsScore, detail: npsDetail, wellSupported: npsWellSupported },
    winRateTrend: { label: "Win rate trend", score: winRateScore, detail: winRateDetail, wellSupported: winRateWellSupported },
  };

  const present = Object.values(components).filter((c): c is YourMomentumComponent & { score: number } => c.score !== null);
  if (present.length === 0) {
    return { score: null, label: "Not enough history yet", confidence: "low", components };
  }

  const score = present.reduce((sum, c) => sum + c.score, 0) / present.length;
  const label: MomentumLabel = score >= HEATING_UP_THRESHOLD ? "Heating up" : score <= COOLING_THRESHOLD ? "Cooling" : "Steady";
  // "full" only once every populated component is itself well-supported —
  // with just two possible components (unlike competitor Momentum's 11),
  // there's no meaningful partial-confidence tier in between.
  const confidence: MomentumConfidence = present.every((c) => c.wellSupported) ? "full" : "low";

  return { score: Math.round(score), label, confidence, components };
}

export { NPS_WINDOW_DAYS };
