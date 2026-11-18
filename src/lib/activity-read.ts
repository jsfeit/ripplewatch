// A day-one read on a competitor, for the weeks before Momentum can exist.
//
// Momentum is a trend: it compares the last 30 days with the 30 before. A competitor added today has one day of
// readings and nothing before it, so for roughly a month its Momentum honestly says "Not enough history yet".
// That is true but not useful on day one. This is the part that IS knowable on day one: how much was found about
// them in the last 30 days, and where they stand right now (open roles, lowest price, review rating, buzz). It
// says nothing about direction, because one reading cannot, and it is never shown once Momentum exists.
//
// Pure, so the labels and wording can be tested.
export type ActivityLabel = "Active" | "Some activity" | "Quiet lately" | "Nothing found yet";

export type ActivityBaseline = {
  openRoles: number | null;
  lowestPrice: number | null;
  reviewRating: number | null;
  buzzMentions: number | null;
};

export type ActivityRead = {
  label: ActivityLabel;
  detail: string;
  baseline: ActivityBaseline;
  // Signals found in the last 30 days; the day-one ranking sorts on this.
  recentSignals: number;
  // One concrete thing worth doing about what was found, written for the person, not for the system.
  nextMove: string;
};

type SignalLike = { occurred_on: string; type?: string };
type ReadingLike = { metric: string; value: number; recorded_at: string };

const WINDOW_DAYS = 30;
// Three or more things found in a month is a competitor doing something worth looking at; one or two is background.
const ACTIVE_AT = 3;

function latest(readings: ReadingLike[], metric: string): number | null {
  const rows = readings.filter((r) => r.metric === metric).sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
  return rows.length > 0 ? rows[0].value : null;
}

const MOVE_BY_TYPE: Record<string, string> = {
  job_posting: "Look at which roles they are opening. Hiring shows where they are investing, so compare it with your roadmap.",
  pricing: "Put their latest pricing next to yours and decide whether it changes how you quote against them.",
  product_change: "Check what they shipped and whether it overlaps with how you pitch.",
  news: "Read what they announced for any change in who they are going after.",
  funding: "Read what the funding is for. It usually tells you where they will spend and who they will hire.",
  review: "Read the newest reviews for what their customers praise and complain about, then use it in your next call.",
  seo: "See which searches they are starting to win, and whether those are searches your buyers use.",
};

// The signal type that showed up most in the last 30 days, ties broken by first seen.
function dominantType(signals: SignalLike[], cutoff: number): string | null {
  const counts = new Map<string, number>();
  for (const s of signals) {
    if (!s.type || new Date(s.occurred_on).getTime() < cutoff) continue;
    counts.set(s.type, (counts.get(s.type) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [t, n] of counts) if (best === null || n > (counts.get(best) ?? 0)) best = t;
  return best;
}

const NOTHING_TO_ACT_ON = "Nothing to act on yet. Tell me about a deal you won or lost against them and I can tell whether they matter to you.";

export function activityRead(signals: SignalLike[], readings: ReadingLike[], now: Date = new Date()): ActivityRead {
  const cutoff = now.getTime() - WINDOW_DAYS * 86_400_000;
  const recent = signals.filter((s) => new Date(s.occurred_on).getTime() >= cutoff).length;
  const older = signals.length - recent;

  const baseline: ActivityBaseline = {
    openRoles: latest(readings, "open_role_count"),
    lowestPrice: latest(readings, "lowest_price"),
    reviewRating: latest(readings, "review_rating"),
    buzzMentions: latest(readings, "buzz_mentions"),
  };

  const top = dominantType(signals, cutoff);
  const nextMove = (top && MOVE_BY_TYPE[top]) || (recent > 0 ? "Ask what changed with them this month." : NOTHING_TO_ACT_ON);
  const plural = (n: number) => `${n} signal${n === 1 ? "" : "s"}`;
  if (recent >= ACTIVE_AT) return { label: "Active", detail: `${plural(recent)} found in the last 30 days`, baseline, recentSignals: recent, nextMove };
  if (recent > 0) return { label: "Some activity", detail: `${plural(recent)} found in the last 30 days`, baseline, recentSignals: recent, nextMove };
  if (older > 0) return { label: "Quiet lately", detail: `Nothing in the last 30 days, ${older} older ${older === 1 ? "signal" : "signals"} on file`, baseline, recentSignals: 0, nextMove };
  return { label: "Nothing found yet", detail: "Nothing found yet", baseline, recentSignals: 0, nextMove };
}

// Said the same way everywhere (the assistant, the finish screen, the guide), so the promise can't drift apart again.
// How the assistant should open when some competitors have no score yet. Findings first, the timing as a closing line.
export const DAY_ONE_BRIEF =
  "Open with what the first check found, not with what is missing. Order the competitors with no score by recent signals, name the one to watch and why (use their baseline: open roles, rating, lowest price), give each a one-line next move from its next_move, and put the Momentum timing in a single closing sentence. Never open with 'nobody is heating up'. Do not invent a score or rank anyone from your own knowledge.";

export const MOMENTUM_TIMING =
  "Momentum is a trend: it compares the last 30 days with the 30 before. A competitor added recently shows \"Not enough history yet\" until there is a month or so of readings, and the score firms up after that.";
