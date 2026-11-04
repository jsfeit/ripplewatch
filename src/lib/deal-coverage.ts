// How much deal history an account has, and what more of it would unlock. Shown wherever deals are
// added and read, so more data is visibly the way to better answers: trends and timing need enough
// deals, enough months, and dates on them.

export type CoverageDeal = {
  closed_on: string | null;
  created_at: string;
  outcome: "won" | "lost" | "churned";
  reason: string | null;
  competitor_id: string | null;
};

export type DealCoverage = {
  level: "none" | "thin" | "building" | "solid";
  dealCount: number;
  wonCount: number;
  lostCount: number;
  churnedCount: number;
  earliest: string | null;
  latest: string | null;
  monthsSpan: number;
  pctDated: number;
  pctWithReason: number;
  pctNamedCompetitor: number;
  message: string;
};

// The deal's own close date when it has one, otherwise the day it was logged.
export function dealDate(row: { closed_on: string | null; created_at: string }): string {
  return row.closed_on ?? row.created_at.slice(0, 10);
}

const SOLID_DEALS = 40;
const SOLID_MONTHS = 6;
const BUILDING_DEALS = 15;
const BUILDING_MONTHS = 2;

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

// The numbers coverage is built from. Counted in the database for big accounts (see loadDealCoverage),
// or tallied from rows when they are already in memory.
export type CoverageStats = {
  dealCount: number;
  wonCount: number;
  lostCount: number;
  churnedCount: number;
  datedCount: number;
  reasonCount: number;
  competitorCount: number;
  earliest: string | null;
  latest: string | null;
};

export function computeDealCoverage(deals: CoverageDeal[]): DealCoverage {
  const dates = deals.map(dealDate).sort();
  return coverageFromStats({
    dealCount: deals.length,
    wonCount: deals.filter((d) => d.outcome === "won").length,
    lostCount: deals.filter((d) => d.outcome === "lost").length,
    churnedCount: deals.filter((d) => d.outcome === "churned").length,
    datedCount: deals.filter((d) => d.closed_on).length,
    reasonCount: deals.filter((d) => d.reason && d.reason.trim()).length,
    competitorCount: deals.filter((d) => d.competitor_id).length,
    earliest: dates[0] ?? null,
    latest: dates[dates.length - 1] ?? null,
  });
}

export function coverageFromStats(stats: CoverageStats): DealCoverage {
  const { dealCount, earliest, latest } = stats;
  const monthsSpan =
    earliest && latest ? Math.max(0, Math.round(((new Date(latest).getTime() - new Date(earliest).getTime()) / 86400000 / 30.4) * 10) / 10) : 0;
  const pctDated = pct(stats.datedCount, dealCount);
  const pctWithReason = pct(stats.reasonCount, dealCount);
  const pctNamedCompetitor = pct(stats.competitorCount, dealCount);

  let level: DealCoverage["level"] = "thin";
  if (dealCount === 0) level = "none";
  else if (dealCount >= SOLID_DEALS && monthsSpan >= SOLID_MONTHS && pctDated >= 70) level = "solid";
  else if (dealCount >= BUILDING_DEALS && monthsSpan >= BUILDING_MONTHS) level = "building";

  return {
    level,
    dealCount,
    wonCount: stats.wonCount,
    lostCount: stats.lostCount,
    churnedCount: stats.churnedCount,
    earliest,
    latest,
    monthsSpan,
    pctDated,
    pctWithReason,
    pctNamedCompetitor,
    message: coverageMessage(level, dealCount, monthsSpan, pctDated, pctWithReason),
  };
}

function coverageMessage(level: DealCoverage["level"], deals: number, months: number, pctDated: number, pctReason: number): string {
  if (level === "none") {
    return "No deals yet. Upload a closed-won and closed-lost export from your CRM, in any format, and Ripplewatch will read it. The more history, the better: go back as far as you have.";
  }
  const span = months >= 1 ? `${Math.round(months)} month${Math.round(months) === 1 ? "" : "s"}` : "under a month";
  const have = `${deals} deal${deals === 1 ? "" : "s"} across ${span}`;
  if (level === "solid") {
    return `${have}. That is enough to see trends over time and line losses up with competitor moves. More history keeps sharpening it.`;
  }
  const gaps: string[] = [];
  if (deals < (level === "thin" ? BUILDING_DEALS : SOLID_DEALS)) {
    gaps.push(`${(level === "thin" ? BUILDING_DEALS : SOLID_DEALS) - deals} more deals`);
  }
  if (months < (level === "thin" ? BUILDING_MONTHS : SOLID_MONTHS)) gaps.push("a longer date range");
  if (pctDated < 70) gaps.push("close dates on the deals");
  if (pctReason < 60) gaps.push("a reason on more of them");
  const next = gaps.length ? gaps.join(", ") : "a bit more history";
  return `${have}. ${level === "thin" ? "Too little to call a trend yet" : "Patterns are starting to show"}. ${next.charAt(0).toUpperCase()}${next.slice(1)} would ${level === "thin" ? "let Ripplewatch spot patterns" : "make the timing analysis reliable"}. Older closed deals count, so upload as far back as you have.`;
}
