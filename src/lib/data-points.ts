// Custom data points: any number a customer has about their own business (approval rate by segment, bank-link
// completion, activation), sent by the assistant as aggregates. Validation lives here, pure, so what gets stored is
// predictable whatever the source looked like. The assistant does the mapping from the customer's own words and tools to
// these fields; this file only refuses what cannot be trusted and tidies what can.
export type DataPointInput = {
  metric: string;
  value: number;
  date: string; // YYYY-MM-DD, the first day the value covers
  period_days?: number;
  label?: string;
  unit?: string;
  segment?: string;
  competitor?: string;
  higher_is?: "better" | "worse" | "neutral";
  note?: string;
};

export type CleanDataPoint = {
  metric: string;
  label: string | null;
  unit: string | null;
  value: number;
  period_start: string;
  period_days: number;
  segment: string;
  competitorName: string | null;
  higher_is: "better" | "worse" | "neutral";
  note: string | null;
};

export const MAX_ROWS_PER_CALL = 400;
export const MAX_METRICS_PER_ACCOUNT = 40;

// "Approval rate (gig workers)" -> approval_rate_gig_workers. Keeps keys stable however the assistant phrases them, so
// the same number sent twice lands on the same row.
export function normalizeMetricKey(raw: string): string | null {
  const key = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return /^[a-z][a-z0-9_]{1,59}$/.test(key) ? key : null;
}

const clip = (v: string | undefined, n: number) => {
  const t = v?.trim();
  return t ? t.slice(0, n) : null;
};

export function cleanDataPoints(rows: DataPointInput[], now: Date = new Date()): { clean: CleanDataPoint[]; rejected: { index: number; reason: string }[] } {
  const clean: CleanDataPoint[] = [];
  const rejected: { index: number; reason: string }[] = [];
  const horizon = now.getTime() + 2 * 86_400_000;

  rows.forEach((r, index) => {
    const metric = normalizeMetricKey(r.metric ?? "");
    if (!metric) return rejected.push({ index, reason: "metric needs letters and numbers, for example approval_rate" });
    if (typeof r.value !== "number" || !Number.isFinite(r.value)) return rejected.push({ index, reason: "value must be a number" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date ?? "") || Number.isNaN(new Date(r.date).getTime())) return rejected.push({ index, reason: "date must be YYYY-MM-DD" });
    if (new Date(r.date).getTime() > horizon) return rejected.push({ index, reason: "date is in the future" });
    const days = r.period_days === undefined ? 7 : Math.round(r.period_days);
    if (!(days >= 1 && days <= 366)) return rejected.push({ index, reason: "period_days must be between 1 and 366" });
    clean.push({
      metric,
      label: clip(r.label, 120),
      unit: clip(r.unit, 20),
      value: r.value,
      period_start: r.date,
      period_days: days,
      segment: (r.segment ?? "").trim().toLowerCase().slice(0, 60),
      competitorName: clip(r.competitor, 120),
      higher_is: r.higher_is ?? "better",
      note: clip(r.note, 300),
    });
  });
  return { clean, rejected };
}

// What the assistant is told when it is deciding what to send, kept next to the validation so the two agree.
export const DATA_POINT_GUIDE =
  "One row per metric, segment and period, as an aggregate you read (a rate, a count, an average), never individual customers. Use a stable metric name (approval_rate, bank_link_completion, activation_rate, avg_limit_usd). Say which way is good with higher_is: better for approval rate, worse for churn or decline rate. Put a cohort in segment (gig_workers, thin_file) when the number is for one group. Never estimate a number you did not read, and ask the user before pulling their data.";
