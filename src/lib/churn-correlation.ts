// Most lost deals and nearly all B2C churn never name who the customer
// picked instead — see 0061_win_loss_unattributed_and_churn. That doesn't
// mean the data is useless: if unattributed losses/churn cluster right
// around when a tracked competitor cut pricing or shipped something new,
// that's a real directional signal even without knowing exactly who won
// any single deal. This never claims a specific customer went to a
// specific competitor — only that the timing lines up, which is the honest
// ceiling on what unattributed data can support.

export type UnattributedEntry = { outcome: "won" | "lost" | "churned"; created_at: string };

export type CompetitorChangeSignal = {
  competitorName: string;
  type: string;
  title: string;
  occurred_on: string;
};

const CORRELATION_WINDOW_DAYS = 14;
// Below this, a "pattern" is just noise — one or two stray losses in two
// weeks is normal background rate, not a spike worth naming.
const MIN_ATTRITION_FOR_CORRELATION = 2;
const MAX_FACTORS_LISTED = 3;

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24);
}

// Returns null when there's genuinely nothing to say — either no
// unattributed attrition in the window, or too few entries to call it a
// pattern rather than noise. Otherwise a short plain-language sentence
// naming the volume and, when timing lines up, which tracked competitors'
// pricing/product moves fell in the same window — always framed as
// "coincides with," never as a claimed cause.
export function buildUnattributedAttritionContext(
  entries: UnattributedEntry[],
  competitorChanges: CompetitorChangeSignal[],
  now: Date = new Date()
): string | null {
  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - CORRELATION_WINDOW_DAYS);

  const attrition = entries.filter(
    (e) => (e.outcome === "lost" || e.outcome === "churned") && new Date(e.created_at) >= windowStart
  );
  if (attrition.length < MIN_ATTRITION_FOR_CORRELATION) return null;

  const lostCount = attrition.filter((e) => e.outcome === "lost").length;
  const churnedCount = attrition.filter((e) => e.outcome === "churned").length;
  const parts: string[] = [];
  if (lostCount > 0) parts.push(`${lostCount} lost deal${lostCount === 1 ? "" : "s"}`);
  if (churnedCount > 0) parts.push(`${churnedCount} churned customer${churnedCount === 1 ? "" : "s"}`);
  const volumePhrase = `${parts.join(" and ")} in the last ${CORRELATION_WINDOW_DAYS} days with no competitor identified`;

  // A change "lines up" if it fell within the same window and within a few
  // days of the attrition entries' own spread — using the window itself
  // (not a tighter sub-range) keeps this simple and legible rather than
  // trying to align individual entries to individual signals, which the
  // data has no real basis for.
  const relevantChanges = competitorChanges.filter((c) => {
    const occurredAt = new Date(c.occurred_on);
    return occurredAt >= windowStart && attrition.some((e) => daysBetween(e.created_at, c.occurred_on) <= 10);
  });

  if (relevantChanges.length === 0) {
    return `${volumePhrase}. No tracked competitor pricing or product changes in the same window to explain it.`;
  }

  const factorList = relevantChanges
    .slice(0, MAX_FACTORS_LISTED)
    .map((c) => `${c.competitorName} (${c.title})`)
    .join(", ");

  return `${volumePhrase}. Coincides with: ${factorList} — a possible factor, not a confirmed cause.`;
}
