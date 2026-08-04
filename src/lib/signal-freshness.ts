// Shared between the dashboard's date filter and AlertCard's "Background"
// badge so the two stay in sync: whatever the filter hides by default is
// exactly what the badge calls out when "All time" is selected. Deliberately
// separate from scraping.ts's FRESHNESS_WINDOW_DAYS (30 days), which gates
// whether an article can be inserted as a signal at all during an ongoing
// crawl — this one only governs display, using the article's real
// occurred_on rather than the account's signup/backfill history.
export const RECENCY_WINDOW_DAYS = 14;

export function isOldSignal(occurredOn: string): boolean {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - RECENCY_WINDOW_DAYS);
  return new Date(occurredOn) < cutoff;
}
