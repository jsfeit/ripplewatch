import "server-only";

// STUB — no real SEO/traffic data source is wired up yet. Ripplewatch
// evaluated Semrush (Business plan mandatory, $549/mo before a single
// query), Ahrefs (Enterprise-only, $1,499/mo), and SE Ranking (~$103/mo
// bundled subscription) against DataForSEO, which is the only one priced to
// match actual usage: pure pay-as-you-go, no monthly floor, ~$0.0006-$0.002
// per lookup depending on speed tier. Once an account is set up:
//   1. Add DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD to env (Basic Auth, per
//      their docs).
//   2. Replace the body of fetchDomainTrafficMetrics below with a real call
//      to their Domain Analytics / traffic-estimate endpoint
//      (https://docs.dataforseo.com/v3/domain_analytics/).
//   3. Delete this comment block and the deterministic fake-data generator.
// Everything else in the pipeline (checkSeoTrafficDiff/checkSeoStructure in
// scraping.ts, the competitor_seo table, tier gating) is already wired to
// call this function and doesn't need to change when the real source lands.

export type DomainTrafficMetrics = {
  organicTrafficEstimate: number;
  trafficTrend: "up" | "down" | "flat" | "unknown";
  topKeywords: string[];
};

// Deterministic (hash of the domain, not random) so repeated stub calls for
// the same competitor don't produce spurious "changes" that would fire
// bogus signals — a real diff check still exercises the full pipeline
// end-to-end against this, it just never actually diffs against itself.
function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export async function fetchDomainTrafficMetrics(domain: string): Promise<DomainTrafficMetrics | null> {
  const seed = hashSeed(domain);
  const trends: DomainTrafficMetrics["trafficTrend"][] = ["up", "down", "flat"];
  return {
    organicTrafficEstimate: 5_000 + (seed % 50_000),
    trafficTrend: trends[seed % trends.length],
    topKeywords: [`${domain.split(".")[0]} pricing`, `${domain.split(".")[0]} alternative`, `${domain.split(".")[0]} vs`],
  };
}
