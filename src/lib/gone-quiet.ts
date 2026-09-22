import type { MarketGrowthDirection } from "@/lib/supabase/types";

// "Gone quiet": a competitor whose silence is worth surfacing, as opposed
// to a competitor who's simply always quiet (the normal case for a small,
// early-stage company — sparse, bursty activity, not a signal on its own).
// See the spec this implements: a fixed "no signals in N weeks" rule would
// fire on most small competitors most of the time and get ignored, so this
// judges silence against context instead: peers, the market, and — once
// there's enough history to trust it — the competitor's own pattern.
//
// Three gates, each answering a different question:
//   1. Peer-relative: is this one unusually quiet next to the OTHER
//      competitors this account tracks right now? Needs no history on the
//      quiet competitor itself, only an active peer set — available from
//      an account's first month.
//   2. Market: is the category actually moving (growth_direction =
//      heating_up)? A quiet competitor during a flat market isn't a story;
//      the same silence during a shift is.
//   3. Personal baseline: once a competitor has enough tracked history to
//      show a real cadence, does the current gap actually break from it?
//      This is the sharpest read, but it never gates the flag on its own —
//      before it's established, gates 1+2 are enough to flag at a lower
//      confidence tier; once established, it also has the final say: if a
//      competitor's own history says this gap is normal for them, that's
//      more informative than 1+2 alone and suppresses the flag rather than
//      keep it at the weaker tier.
export type GoneQuietTier = "category_context" | "own_pattern";

export type GoneQuietResult = {
  tier: GoneQuietTier;
  reason: string;
};

type SignalLike = { competitor_id: string; occurred_on: string };

const SETTLING_WINDOW_DAYS = 21; // a freshly-added competitor has no history to read silence from
const PEER_WINDOW_DAYS = 30;
const MIN_PEERS = 2; // below this, "relative to peers" isn't a meaningful comparison
const BASELINE_LOOKBACK_DAYS = 182; // ~26 weeks
const BASELINE_MIN_SIGNALS = 3;
const BASELINE_MIN_ACTIVE_WEEKS = 8; // out of 26 — enough weeks with activity to call it a real cadence
const GAP_MULTIPLIER = 3; // how many multiples of their typical gap counts as "broken from pattern"
const GAP_FLOOR_DAYS = 28; // never trip this on a gap shorter than 4 weeks, even for a very bursty competitor

function daysAgo(iso: string, nowMs: number): number {
  return (nowMs - new Date(iso).getTime()) / 86_400_000;
}

export function detectGoneQuiet(params: {
  competitorId: string;
  competitorCreatedAt: string;
  // Every actively-tracked competitor's signals on this account, covering
  // at least BASELINE_LOOKBACK_DAYS — the same 180-day window
  // computeMomentum's reliability weighting already needs, so callers can
  // reuse one query for both.
  allSignals: SignalLike[];
  peerCompetitorIds: string[];
  marketGrowthDirection: MarketGrowthDirection | null;
  now?: Date;
}): GoneQuietResult | null {
  const nowMs = (params.now ?? new Date()).getTime();

  if (daysAgo(params.competitorCreatedAt, nowMs) < SETTLING_WINDOW_DAYS) return null;

  // Gate 2 first — cheapest check, and nothing else matters if the market
  // isn't moving. Cooling is deliberately excluded: a competitor going
  // quiet while the whole category contracts more often reads as
  // struggling, not maneuvering — a different story than this one.
  if (params.marketGrowthDirection !== "heating_up") return null;

  const mySignals = params.allSignals.filter((s) => s.competitor_id === params.competitorId);
  const myRecentCount = mySignals.filter((s) => daysAgo(s.occurred_on, nowMs) <= PEER_WINDOW_DAYS).length;
  if (myRecentCount > 0) return null; // has activity, nothing to flag

  // Gate 1: quiet relative to the peers this account is actually tracking
  // right now, not a fixed "0 signals" threshold.
  const usablePeerIds = params.peerCompetitorIds.filter((id) => id !== params.competitorId);
  if (usablePeerIds.length < MIN_PEERS) return null;
  const peerCounts = usablePeerIds
    .map((id) => params.allSignals.filter((s) => s.competitor_id === id && daysAgo(s.occurred_on, nowMs) <= PEER_WINDOW_DAYS).length)
    .sort((a, b) => a - b);
  const peerMedian = peerCounts[Math.floor(peerCounts.length / 2)];
  if (peerMedian < 1) return null; // peers are quiet too — not unusual, probably a slow niche

  // Gate 3: layer in a personal baseline once there's enough history for
  // one. Not required to flag, but authoritative once available — see the
  // module comment for why suppressing (not just downgrading) is the
  // right call when a competitor's own history disagrees.
  const baselineSignals = mySignals.filter((s) => daysAgo(s.occurred_on, nowMs) <= BASELINE_LOOKBACK_DAYS);
  const activeWeeks = new Set(baselineSignals.map((s) => Math.floor(daysAgo(s.occurred_on, nowMs) / 7))).size;
  const established = baselineSignals.length >= BASELINE_MIN_SIGNALS && activeWeeks >= BASELINE_MIN_ACTIVE_WEEKS;

  if (!established) {
    return {
      tier: "category_context",
      reason:
        "Quieter than the other competitors you're tracking, while the market is heating up. Not enough history yet to know their normal pace.",
    };
  }

  const lastSignalAt = mySignals.reduce<string | null>((latest, s) => (!latest || s.occurred_on > latest ? s.occurred_on : latest), null);
  const gapDays = lastSignalAt ? daysAgo(lastSignalAt, nowMs) : BASELINE_LOOKBACK_DAYS;
  const typicalGapDays = BASELINE_LOOKBACK_DAYS / activeWeeks;
  const threshold = Math.max(GAP_FLOOR_DAYS, typicalGapDays * GAP_MULTIPLIER);
  if (gapDays < threshold) return null; // their own history says this gap isn't unusual for them

  const gapWeeks = Math.max(1, Math.round(gapDays / 7));
  return {
    tier: "own_pattern",
    reason: `Steady activity for months, then nothing for ${gapWeeks} week${gapWeeks === 1 ? "" : "s"}, well outside their usual pace. The market is heating up too.`,
  };
}
