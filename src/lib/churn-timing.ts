import type { MetricsRead } from "@/lib/customer-metrics";

// Lines up when churn started rising against what tracked competitors did around then. This only
// ever says the timing coincides. It never claims a cause: a consumer company usually cannot see
// where a customer went, and a price cut that landed the same month might be unrelated.

export type CompetitorEvent = {
  competitorName: string;
  type: string;
  title: string;
  occurredOn: string;
  // Which side the competitor competes on. Null or "both" counts for either.
  side: "business" | "consumer" | "both" | null;
};

export type ChurnTiming = {
  // First day of the month churn started rising.
  since: string;
  events: { competitorName: string; type: string; title: string; occurredOn: string }[];
  sentence: string;
};

// Pricing and product moves are the ones that plausibly move churn. News and funding are weaker
// leads, jobs and the rest are noise here.
const WEIGHT: Record<string, number> = { pricing: 3, product_change: 3, news: 1, funding: 1 };

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_LISTED = 3;

function monthName(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
function dayName(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
function typeName(type: string): string {
  return type === "pricing" ? "a pricing change" : type === "product_change" ? "a product change" : type === "funding" ? "funding news" : "news";
}

export function lineUpChurn(read: MetricsRead, events: CompetitorEvent[], segment: "business" | "consumer" = "consumer"): ChurnTiming | null {
  if (read.trend !== "rising" || !read.risingSince) return null;

  const start = new Date(`${read.risingSince}T00:00:00Z`).getTime();
  // From a month before churn rose (a move can take weeks to bite) to six weeks after it started.
  const from = start - 30 * DAY_MS;
  const to = start + 45 * DAY_MS;

  const relevant = events
    .filter((e) => e.type in WEIGHT)
    .filter((e) => e.side === null || e.side === "both" || e.side === segment)
    .filter((e) => {
      const t = new Date(`${e.occurredOn}T00:00:00Z`).getTime();
      return Number.isFinite(t) && t >= from && t <= to;
    })
    .sort((a, b) => WEIGHT[b.type] - WEIGHT[a.type] || a.occurredOn.localeCompare(b.occurredOn));

  const since = read.risingSince;
  const lead = `Churn started rising around ${monthName(since)}.`;
  const caveat = read.confidence === "low" ? "That's an early lead from very little data." : "It's timing only, not proof of cause.";

  if (relevant.length === 0) {
    return {
      since,
      events: [],
      sentence: `${lead} I didn't see a pricing or product move from a tracked competitor in that window, so the cause may be closer to home, such as your own pricing, a product change or the season. ${caveat}`,
    };
  }

  const shown = relevant.slice(0, MAX_LISTED);
  const list = shown.map((e) => `${e.competitorName} had ${typeName(e.type)} on ${dayName(e.occurredOn)}`).join("; ");
  const more = relevant.length > shown.length ? `, and ${relevant.length - shown.length} more` : "";
  return {
    since,
    events: shown.map(({ competitorName, type, title, occurredOn }) => ({ competitorName, type, title, occurredOn })),
    sentence: `${lead} Around then: ${list}${more}. ${caveat}`,
  };
}
