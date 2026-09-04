// Buckets job-posting and pricing signals into calendar months for the
// Industry Pulse chart — real signal data from actual scraping, aggregated
// across every tracked competitor rather than per-competitor, since the
// point is a category-level activity read that still works when any one
// competitor is too small to generate much individual signal volume.
const MONTHS_BACK = 6;
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type MonthlyActivityBucket = { label: string; hiring: number; pricing: number };

export function bucketMonthlyActivity(
  signals: { type: string; occurred_on: string }[]
): MonthlyActivityBucket[] {
  const now = new Date();
  const buckets: MonthlyActivityBucket[] = [];
  const keyIndex = new Map<string, number>();

  for (let i = MONTHS_BACK - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    keyIndex.set(key, buckets.length);
    buckets.push({ label: MONTH_LABELS[d.getUTCMonth()], hiring: 0, pricing: 0 });
  }

  for (const signal of signals) {
    const d = new Date(signal.occurred_on);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const index = keyIndex.get(key);
    if (index === undefined) continue;
    if (signal.type === "job_posting") buckets[index].hiring += 1;
    else if (signal.type === "pricing") buckets[index].pricing += 1;
  }

  return buckets;
}
