// Churn and growth over time. Pure functions with no DB or secret access, so the
// server routes and the setup screen share one implementation.
//
// A consumer company usually cannot say why each customer left, or whether they also use a
// competitor. It does know its churn rate and customer counts, and a change in the rate with a
// date on it is something Ripplewatch can line up against competitor moves. This reads those
// numbers and says plainly how sure it is: two months is a lead, never a finding.

export type MetricPeriod = {
  // First day of the month, YYYY-MM-01.
  periodStart: string;
  customersStart: number | null;
  newCustomers: number | null;
  cancelledCustomers: number | null;
  customersEnd: number | null;
  revenue: number | null;
  // Given directly, 0 to 100. Otherwise worked out from cancelled / start.
  churnPct: number | null;
};

export type MetricsRead = {
  periods: number;
  // Percent. Null when the data cannot say.
  latestChurn: number | null;
  earlierChurn: number | null;
  averageChurn: number | null;
  trend: "rising" | "falling" | "flat" | null;
  // First month of the recent run that sits above the earlier level, when churn is rising.
  risingSince: string | null;
  // Average customer growth per month, percent.
  customerGrowth: number | null;
  // Average revenue growth per month, percent. Null unless revenue was given.
  revenueGrowth: number | null;
  // "low" below three months of data. Never "high": the numbers alone cannot show cause.
  confidence: "low" | "medium";
  headline: string;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

export function periodChurn(p: MetricPeriod): number | null {
  if (p.churnPct !== null) return p.churnPct;
  if (p.cancelledCustomers !== null && p.customersStart !== null && p.customersStart > 0) {
    return (p.cancelledCustomers / p.customersStart) * 100;
  }
  return null;
}

// Net customer growth for one period, percent of the customers at the start.
export function periodGrowth(p: MetricPeriod): number | null {
  if (p.customersStart === null || p.customersStart <= 0) return null;
  if (p.customersEnd !== null) return ((p.customersEnd - p.customersStart) / p.customersStart) * 100;
  if (p.newCustomers !== null && p.cancelledCustomers !== null) {
    return ((p.newCustomers - p.cancelledCustomers) / p.customersStart) * 100;
  }
  return null;
}

// Average month-on-month change in revenue across consecutive periods that both have it.
function revenueGrowth(sorted: MetricPeriod[]): number | null {
  const changes: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1].revenue;
    const b = sorted[i].revenue;
    if (a !== null && b !== null && a > 0) changes.push(((b - a) / a) * 100);
  }
  return mean(changes);
}

export function analyzeMetrics(periods: MetricPeriod[]): MetricsRead {
  const sorted = [...periods].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  const churn = sorted.map((p) => ({ start: p.periodStart, value: periodChurn(p) })).filter((c): c is { start: string; value: number } => c.value !== null);

  const averageChurn = mean(churn.map((c) => c.value));
  const customerGrowth = mean(sorted.map(periodGrowth).filter((g): g is number => g !== null));
  const revGrowth = revenueGrowth(sorted);

  // Compare the most recent run of months with the run before it. Three each when there is
  // enough data, fewer when there is not.
  let trend: MetricsRead["trend"] = null;
  let latestChurn: number | null = null;
  let earlierChurn: number | null = null;
  let risingSince: string | null = null;
  if (churn.length >= 2) {
    const window = Math.min(3, Math.floor(churn.length / 2));
    const recent = churn.slice(-window);
    const earlier = churn.slice(-window * 2, -window);
    latestChurn = mean(recent.map((c) => c.value));
    earlierChurn = mean(earlier.map((c) => c.value));
    if (latestChurn !== null && earlierChurn !== null) {
      const delta = latestChurn - earlierChurn;
      // Half a point, or a tenth of the earlier level, whichever is larger: smaller moves are noise.
      const threshold = Math.max(0.5, earlierChurn * 0.1);
      trend = delta >= threshold ? "rising" : delta <= -threshold ? "falling" : "flat";
      if (trend === "rising") risingSince = recent.find((c) => c.value > earlierChurn! + threshold / 2)?.start ?? recent[0].start;
    }
  } else if (churn.length === 1) {
    latestChurn = churn[0].value;
  }

  const confidence: MetricsRead["confidence"] = churn.length >= 3 ? "medium" : "low";

  return {
    periods: sorted.length,
    latestChurn: latestChurn === null ? null : round1(latestChurn),
    earlierChurn: earlierChurn === null ? null : round1(earlierChurn),
    averageChurn: averageChurn === null ? null : round1(averageChurn),
    trend,
    risingSince,
    customerGrowth: customerGrowth === null ? null : round1(customerGrowth),
    revenueGrowth: revGrowth === null ? null : round1(revGrowth),
    confidence,
    headline: describeMetrics({
      months: churn.length,
      latestChurn,
      earlierChurn,
      averageChurn,
      trend,
      customerGrowth,
      revenueGrowth: revGrowth,
      confidence,
    }),
  };
}

function monthsLabel(n: number): string {
  return `${n} month${n === 1 ? "" : "s"}`;
}

function describeMetrics(r: {
  months: number;
  latestChurn: number | null;
  earlierChurn: number | null;
  averageChurn: number | null;
  trend: MetricsRead["trend"];
  customerGrowth: number | null;
  revenueGrowth: number | null;
  confidence: MetricsRead["confidence"];
}): string {
  if (r.months === 0) return "There isn't enough in that to read a churn rate from. Add cancelled customers and the customers you started with, or the rate itself.";
  const parts: string[] = [];
  if (r.trend === "rising" && r.earlierChurn !== null && r.latestChurn !== null) {
    parts.push(`Churn rose from ${round1(r.earlierChurn)}% to ${round1(r.latestChurn)}%.`);
  } else if (r.trend === "falling" && r.earlierChurn !== null && r.latestChurn !== null) {
    parts.push(`Churn fell from ${round1(r.earlierChurn)}% to ${round1(r.latestChurn)}%.`);
  } else if (r.trend === "flat" && r.latestChurn !== null) {
    parts.push(`Churn is holding steady at about ${round1(r.latestChurn)}%.`);
  } else if (r.latestChurn !== null) {
    parts.push(`Churn is ${round1(r.latestChurn)}%.`);
  }
  if (r.customerGrowth !== null) {
    parts.push(`Customers ${r.customerGrowth >= 0 ? "grew" : "shrank"} ${Math.abs(round1(r.customerGrowth))}% a month on average.`);
  }
  if (r.revenueGrowth !== null) {
    parts.push(`Revenue ${r.revenueGrowth >= 0 ? "grew" : "fell"} ${Math.abs(round1(r.revenueGrowth))}% a month.`);
  }
  parts.push(
    r.confidence === "low"
      ? `That's only ${monthsLabel(r.months)} of data, so treat it as a lead, not a finding.`
      : r.trend === "rising" || r.trend === "falling"
        ? `Based on ${monthsLabel(r.months)} of data. It shows when churn moved, not why.`
        : `Based on ${monthsLabel(r.months)} of data.`
  );
  return parts.join(" ");
}

// Normalises any date-ish value to the first of its month, or null.
export function monthStart(value: string): string | null {
  const m = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?/.exec(value.trim());
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return `${m[1]}-${String(month).padStart(2, "0")}-01`;
}
