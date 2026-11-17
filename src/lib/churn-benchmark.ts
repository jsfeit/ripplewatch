// What is typical for this kind of product, so a churn rate can be read against it. The range comes
// from a published source or not at all: a benchmark with no source, or no range, is dropped.

export type ChurnBenchmark = {
  // The kind of product the range is for, for example "consumer subscription apps".
  category: string;
  lowPct: number;
  highPct: number;
  sourceName: string;
  sourceUrl: string;
  // Anything worth knowing about how the figure was derived, such as a conversion from annual churn.
  note: string;
};

export function parseBenchmark(raw: unknown): ChurnBenchmark | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const low = typeof r.lowPct === "number" ? r.lowPct : typeof r.lowMonthlyPct === "number" ? r.lowMonthlyPct : null;
  const high = typeof r.highPct === "number" ? r.highPct : typeof r.highMonthlyPct === "number" ? r.highMonthlyPct : null;
  const category = typeof r.category === "string" ? r.category.trim().slice(0, 120) : "";
  const sourceName = typeof r.sourceName === "string" ? r.sourceName.trim().slice(0, 160) : "";
  const sourceUrl = typeof r.sourceUrl === "string" ? r.sourceUrl.trim().slice(0, 500) : "";
  if (low === null || high === null || !Number.isFinite(low) || !Number.isFinite(high)) return null;
  if (low < 0 || high > 100 || low > high) return null;
  if (!category || !sourceName || !/^https:\/\//i.test(sourceUrl)) return null;
  return {
    category,
    lowPct: Math.round(low * 10) / 10,
    highPct: Math.round(high * 10) / 10,
    sourceName,
    sourceUrl,
    note: typeof r.note === "string" ? r.note.trim().slice(0, 300) : "",
  };
}

export type BenchmarkComparison = { position: "above" | "within" | "below"; sentence: string };

export function compareToBenchmark(latestChurn: number | null, benchmark: ChurnBenchmark | null): BenchmarkComparison | null {
  if (latestChurn === null || !benchmark) return null;
  const range = `${benchmark.lowPct}% to ${benchmark.highPct}%`;
  const base = `Published figures for ${benchmark.category} put monthly churn at roughly ${range} (${benchmark.sourceName}).`;
  if (latestChurn > benchmark.highPct) {
    return { position: "above", sentence: `${base} At ${latestChurn}% you're above that range. Ranges like this vary a lot by price and audience, so use it as context.` };
  }
  if (latestChurn < benchmark.lowPct) {
    return { position: "below", sentence: `${base} At ${latestChurn}% you're below that range, which is good.` };
  }
  return { position: "within", sentence: `${base} At ${latestChurn}% you're within it.` };
}
