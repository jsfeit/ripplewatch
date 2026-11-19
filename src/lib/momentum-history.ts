import { computeMomentum, type MomentumResult } from "@/lib/momentum";

// Momentum over time, and what changed this week.
//
// Momentum is a pure function of the data and a moment in time, so history needs no stored snapshots: recompute it as of
// a week ago, two weeks ago and so on, from only the data that existed then. That also means history is available the
// moment a competitor's earlier readings are backfilled, not after weeks of saving scores.
type Params = Parameters<typeof computeMomentum>;
type Signal = Params[0][number];
type Deal = NonNullable<Params[1]>[number];
type Reading = NonNullable<Params[2]>[number];

export type SeriesPoint = { daysAgo: number; score: number | null; label: string };
export type Movement = {
  from: string;
  to: string;
  scoreChange: number | null;
  // The components that moved the most right now, as the same plain detail text Momentum already writes.
  drivers: string[];
};

const DAY = 86_400_000;

// Scores at now, 7, 14, 21 and 28 days ago, oldest first.
export function momentumSeries(signals: Signal[], deals: Deal[], readings: Reading[], now: Date = new Date(), points = 5, stepDays = 7): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (let i = points - 1; i >= 0; i--) {
    const daysAgo = i * stepDays;
    const at = new Date(now.getTime() - daysAgo * DAY);
    const result = computeMomentum(
      signals.filter((s) => new Date(s.occurred_on).getTime() <= at.getTime()),
      deals.filter((d) => new Date(d.created_at).getTime() <= at.getTime()),
      readings.filter((r) => new Date(r.recorded_at).getTime() <= at.getTime()),
      at
    );
    out.push({ daysAgo, score: result.score, label: result.label });
  }
  return out;
}

const REAL = (label: string) => label === "Heating up" || label === "Steady" || label === "Cooling";

// A movement is worth saying out loud when the band changed between a week ago and now, with a real read on both
// sides, or the score itself swung by 20 or more. A competitor going from "no read" to a read is not a movement.
// A competitor tracked for under two weeks has no real "last week": that point is rebuilt from backdated data, and
// calling the difference a movement would report something that did not happen. `trackedSince` is when we started watching.
const MIN_TRACKED_DAYS = 14;

export function detectMovement(series: SeriesPoint[], current: MomentumResult, trackedSince?: string | null, nowMs: number = Date.now()): Movement | null {
  if (trackedSince && nowMs - new Date(trackedSince).getTime() < MIN_TRACKED_DAYS * DAY) return null;
  const now = series[series.length - 1];
  const weekAgo = series.find((p) => p.daysAgo === 7);
  if (!now || !weekAgo || !REAL(now.label) || !REAL(weekAgo.label)) return null;
  const change = now.score !== null && weekAgo.score !== null ? now.score - weekAgo.score : null;
  const bandChanged = now.label !== weekAgo.label;
  if (!bandChanged && !(change !== null && Math.abs(change) >= 20)) return null;

  const drivers = Object.values(current.components)
    .filter((c) => c.score !== null && Math.abs(c.score) >= 30)
    .sort((a, b) => Math.abs(b.score ?? 0) - Math.abs(a.score ?? 0))
    .slice(0, 3)
    .map((c) => `${c.label}: ${c.detail}`);
  return { from: weekAgo.label, to: now.label, scoreChange: change, drivers };
}

export function movementSentence(name: string, m: Movement): string {
  const move = m.from === m.to ? `${m.scoreChange !== null && m.scoreChange > 0 ? "picked up" : "slowed down"} (${m.scoreChange !== null ? (m.scoreChange > 0 ? "+" : "") + m.scoreChange : ""} points)` : `moved from ${m.from} to ${m.to}`;
  return `${name} ${move}${m.drivers.length ? `: ${m.drivers[0]}` : ""}.`;
}
