// Factual claims here should trace back to public research (pricing pages,
// product marketing, review sites) — these are comparison pages, not
// disparagement, so "what they do well" has to be genuinely true or the
// whole page loses credibility. Update if a competitor's product changes.

export type ComparisonEntry = {
  slug: string;
  name: string;
  domain: string;
  tagline: string;
  whatTheyDoWell: string;
  theirMechanism: string;
  differentiator: string;
};

export const COMPARISONS: ComparisonEntry[] = [
  {
    slug: "caelian",
    name: "Caelian",
    domain: "caelian.ai",
    tagline:
      "A live dashboard and daily brief built around a P0/P1/P2 priority framework, aimed at CEOs rather than analysts.",
    whatTheyDoWell:
      "Caelian's priority framework is genuinely useful triage — a P0/P1/P2 threshold that suppresses everything below it from the daily brief, so a CEO gets one glance at what's actually urgent instead of a full feed. It also leans predictive: hiring velocity and regulatory filings are treated as leading indicators rather than waiting for a launch or a press release to confirm a move.",
    theirMechanism: "a P0/P1/P2 priority framework",
    differentiator:
      "The priority level itself is generic severity — the same kind of signal gets the same P0/P1/P2 rating regardless of whose business is reading it. Ripplewatch's relevance score is computed against your specific positioning, ICP, and the actual reasons your deals were lost or customers churned. The same signal can be High for one company and Low for another, because it's scored against what matters to that business, not a general urgency scale.",
  },
];

export function getComparison(slug: string): ComparisonEntry | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}
