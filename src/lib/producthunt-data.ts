import "server-only";

// STUB — no real Product Hunt data source is wired up yet. Product Hunt's
// GraphQL API is free but requires a developer account + OAuth token
// (https://api.producthunt.com/v2/docs) — nothing to evaluate for cost like
// the SEO/DataForSEO decision, just an account to create. Once one exists:
//   1. Add PRODUCTHUNT_API_TOKEN to env.
//   2. Replace the body of fetchProductHuntLaunches below with a real query
//      against the GraphQL API's `posts` search (filter by company/maker
//      name, order by newest).
//   3. Delete this comment block and the deterministic fake-data generator.
// Everything else in the pipeline (checkProductHuntLaunches in scraping.ts,
// the page_snapshots "producthunt" diff/cadence, tier gating) is already
// wired to call this function and doesn't need to change when real data
// lands.

export type ProductHuntLaunch = {
  title: string;
  tagline: string;
  url: string;
};

// Deterministic (hash of the company name, not random) so repeated stub
// calls for the same competitor don't produce spurious "new launches" that
// would fire bogus signals — same rationale as seo-data.ts's stub.
function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export async function fetchProductHuntLaunches(companyName: string): Promise<ProductHuntLaunch[]> {
  const seed = hashSeed(companyName);
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return [
    {
      title: `${companyName} ${seed % 2 === 0 ? "2.0" : "AI"}`,
      tagline: `The next version of ${companyName}, now with more AI.`,
      url: `https://www.producthunt.com/posts/${slug}`,
    },
  ];
}
