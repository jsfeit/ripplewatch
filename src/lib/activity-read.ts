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

export type ActivityRead = { label: ActivityLabel; detail: string; baseline: ActivityBaseline };

type SignalLike = { occurred_on: string };
type ReadingLike = { metric: string; value: number; recorded_at: string };

const WINDOW_DAYS = 30;
// Three or more things found in a month is a competitor doing something worth looking at; one or two is background.
const ACTIVE_AT = 3;

function latest(readings: ReadingLike[], metric: string): number | null {
  const rows = readings.filter((r) => r.metric === metric).sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
  return rows.length > 0 ? rows[0].value : null;
}

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

  const plural = (n: number) => `${n} signal${n === 1 ? "" : "s"}`;
  if (recent >= ACTIVE_AT) return { label: "Active", detail: `${plural(recent)} found in the last 30 days`, baseline };
  if (recent > 0) return { label: "Some activity", detail: `${plural(recent)} found in the last 30 days`, baseline };
  if (older > 0) return { label: "Quiet lately", detail: `Nothing in the last 30 days, ${older} older ${older === 1 ? "signal" : "signals"} on file`, baseline };
  return { label: "Nothing found yet", detail: "Nothing found yet", baseline };
}

// Said the same way everywhere (the assistant, the finish screen, the guide), so the promise can't drift apart again.
export const MOMENTUM_TIMING =
  "Momentum is a trend: it compares the last 30 days with the 30 before. A competitor added recently shows \"Not enough history yet\" until there is a month or so of readings, and the score firms up after that.";
