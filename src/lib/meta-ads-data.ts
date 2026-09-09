import "server-only";

// Meta's Ad Library API is the one place a company's *active* ad activity is
// public and legitimately queryable — no spend numbers, but "how many ads
// are currently running" is a real, free directional signal for "are they
// ramping paid acquisition." Unlike GitHub/Wayback/HN, this one genuinely
// needs a credential: Meta requires a Graph API access token from a
// registered Meta developer app (their ad-transparency APIs require the
// requesting app to be authorized, even for read-only public data) — not
// something Ripplewatch can obtain on its own. Set
// META_AD_LIBRARY_ACCESS_TOKEN to enable this check; checkAdActivity in
// scraping.ts skips entirely (no crawl error, just no reading) when it's
// unset, the same pattern ENABLE_WEB_SEARCH_NEWS already uses for an
// opt-in, credentialed source.
//
// A real, structural limit confirmed against Meta's own docs (the
// ad_reached_countries field description): "Ads that did not reach any
// location in the EU will only return if they are about social issues,
// elections or politics." So a plain US-only commercial campaign is
// invisible to this API no matter what — it only ever surfaces (a)
// political/social-issue ads worldwide, or (b) any ad type that reached the
// EU/UK. In practice this means real data only for competitors who
// advertise into the EU/UK; zero for US-only advertisers is expected, not
// a bug.
//
// ad_reached_countries is queried against the full EU-27 + UK (+ US, which
// costs nothing to include) rather than just "US" — restricting to US
// alone would additionally require the ad to have reached the US on top of
// already-required EU/UK reach, needlessly narrowing an already-narrow
// dataset. Confirmed live: "ALL" as a single value does NOT work here
// (returns empty) despite being a documented enum option — that shorthand
// only applies to political/issue-ad queries, not general ad_type=ALL
// searches, so an explicit country list is required.
const AD_REACHED_COUNTRIES = [
  "US",
  "GB",
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
];

const AD_LIBRARY_BASE = "https://graph.facebook.com/v21.0/ads_archive";

// The API returns a page of results, not a total count — this is however
// many active ads the search actually turned up, capped at one page. Good
// enough for "roughly how active are they," not an exact figure; the UI
// should present it as a floor (e.g. "100+ active ads") when the count hits
// the page limit exactly, since that means there's more we didn't fetch.
const PAGE_LIMIT = 100;

export type AdActivityResult = { count: number; isFloor: boolean };

export async function fetchActiveAdCount(companyName: string): Promise<AdActivityResult | null> {
  const token = process.env.META_AD_LIBRARY_ACCESS_TOKEN;
  if (!token) return null;

  const params = new URLSearchParams({
    search_terms: companyName,
    ad_reached_countries: JSON.stringify(AD_REACHED_COUNTRIES),
    ad_active_status: "ACTIVE",
    fields: "id",
    limit: String(PAGE_LIMIT),
    access_token: token,
  });

  try {
    const res = await fetch(`${AD_LIBRARY_BASE}?${params.toString()}`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.error(`Meta Ad Library fetch failed (${res.status}) for ${companyName}`);
      return null;
    }
    const data = (await res.json()) as { data?: unknown[]; paging?: { next?: string } };
    if (!Array.isArray(data.data)) return null;
    return { count: data.data.length, isFloor: data.data.length >= PAGE_LIMIT && Boolean(data.paging?.next) };
  } catch (err) {
    console.error(`Meta Ad Library fetch failed for ${companyName}:`, err);
    return null;
  }
}
