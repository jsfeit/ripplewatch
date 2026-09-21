import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  probeSnapshotHomepage,
  fetchSnapshotPricingText,
  fetchSnapshotHiring,
  fetchSnapshotAlternates,
  fetchSnapshotTypoAlternates,
  extractDiscoveredUrls,
  withTimeout,
  type SnapshotHiring,
  type SnapshotReachability,
} from "@/lib/scraping";
import { extractPricingStructure, researchDomainPublicly, type PublicResearch } from "@/lib/anthropic";
import type { BillingModel, Database } from "@/lib/supabase/types";

// What the visitor can be told about pricing, from most to least useful:
//   public            real numbers found
//   public_no_numbers a public page, but nothing we could turn into a price
//   sales_led         they don't publish prices (a real answer, not a failure)
//   unreadable        we loaded a pricing page but couldn't make sense of it
//   no_page           the site is up but we couldn't find a pricing page
//   unreachable       we couldn't load the site at all (bot protection, outage)
export type SnapshotPricingState =
  | "public"
  | "public_no_numbers"
  | "sales_led"
  | "unreadable"
  | "no_page"
  | "unreachable";

export type SnapshotResult = {
  domain: string;
  reachable: boolean;
  title: string | null;
  pricing: {
    state: SnapshotPricingState;
    billingModel: BillingModel | null;
    tiers: { name: string; price: number | null; price_period: string | null; features: string[] }[];
    // "wayback" means the numbers come from an archived copy, so the UI has
    // to say so rather than present them as a live read.
    source: "live" | "wayback" | null;
    capturedAt: string | null;
  };
  hiring: SnapshotHiring;
  // Why the homepage couldn't be read (or "ok"), so the UI can say what
  // actually happened: mistyped domain vs a site that blocks automated
  // requests vs a site that's down.
  reachability: SnapshotReachability;
  // Set only when the site couldn't be read directly and a search of public
  // sources found something reliable about it; the UI labels it as such
  // rather than presenting it as a live read.
  research: PublicResearch | null;
  // Other sites with the same name on a different domain ending (e.g. arlo.co
  // for arlo.com), so a visitor who typed the wrong one can switch in a
  // click. Empty when there's nothing that looks like a different company.
  alternates: { domain: string; title: string }[];
  // True when the site itself gave us pricing or open roles directly (as
  // opposed to only an archived copy's absence, research, or nothing). Used
  // for paying customers' competitors, where research alone isn't enough to
  // skip a person's review.
  readDirectly: boolean;
  // True when we couldn't answer either question automatically. The route
  // alerts the admin so a human can follow up instead of the visitor being
  // left at a dead end.
  needsManualCheck: boolean;
};

// Web search runs a multi-step loop on Anthropic's side; cap how long the
// visitor waits for it.
// How long the page fetches get when the homepage was blocked and research is
// running in parallel.
const BLOCKED_FETCH_BUDGET_MS = 12_000;
const RESEARCH_TIMEOUT_MS = 40_000;

export async function buildSnapshot(
  domain: string,
  // False once the day's cap on anonymous LLM calls is reached (see the
  // route): pages are still fetched and hiring still read, but the pricing
  // page isn't sent to Claude, so the visitor gets the manual follow-up path
  // instead of the feature spending without limit.
  opts: {
    llmAllowed?: boolean;
    researchAllowed?: boolean;
    // Set for a signed-in customer's competitor so its LLM spend is
    // attributed to their account instead of the anonymous pool.
    accountId?: string | null;
  } = {}
): Promise<SnapshotResult> {
  const llmAllowed = opts.llmAllowed ?? true;
  const researchAllowed = opts.researchAllowed ?? true;
  const accountId = opts.accountId ?? null;
  // Started first so it runs alongside everything else instead of adding to
  // the visitor's wait.
  const alternatesPromise = fetchSnapshotAlternates(domain);
  const probe = await probeSnapshotHomepage(domain);
  const home = probe.page;
  // A domain that doesn't load and isn't just refusing us is most likely
  // mistyped; look for the near-miss spelling while the rest runs.
  const deadDomain = probe.reachability === "no_such_site" || probe.reachability === "placeholder";
  const typoPromise =
    deadDomain || (!home && probe.reachability !== "blocked")
      ? fetchSnapshotTypoAlternates(domain)
      : Promise.resolve([]);

  // A placeholder page or a domain that doesn't exist has no pricing or job
  // board to find, so skip the slow fetch phase entirely and just report it
  // plus the nearest real sites.
  if (probe.reachability === "placeholder" || probe.reachability === "no_such_site") {
    const alternates = [...(await typoPromise), ...(await alternatesPromise)]
      .filter((alt) => alt.title.toLowerCase() !== (home?.title ?? "").toLowerCase())
      .slice(0, 3)
      .map(({ domain: altDomain, title }) => ({ domain: altDomain, title }));
    return {
      domain,
      reachable: probe.reachability === "placeholder",
      title: home?.title ?? null,
      pricing: {
        state: probe.reachability === "placeholder" ? "no_page" : "unreachable",
        billingModel: null,
        tiers: [],
        source: null,
        capturedAt: null,
      },
      hiring: { status: "unavailable" },
      reachability: probe.reachability,
      research: null,
      alternates,
      readDirectly: false,
      needsManualCheck: false,
    };
  }
  const discovered = home ? extractDiscoveredUrls(home.html, home.finalUrl) : { pricingUrl: null, careersUrl: null };

  // A homepage that refused or wouldn't connect makes the research fallback
  // likely, so start it now and let it overlap with the page fetches below
  // instead of adding its time to the end. If the fetches turn out to answer
  // the question after all, its result is simply ignored.
  const runResearch = (): Promise<PublicResearch | null> =>
    withTimeout(
      researchDomainPublicly(domain, home?.title ?? null, accountId).catch((err) => {
        console.error(`snapshot research failed for ${domain}:`, err);
        return null;
      }),
      RESEARCH_TIMEOUT_MS
    );
  const researchStartedAt = Date.now();
  const wantsResearch = researchAllowed && (probe.reachability === "blocked" || probe.reachability === "unreachable");
  const researchPromise: Promise<PublicResearch | null> = wantsResearch ? runResearch() : Promise.resolve(null);

  // If the homepage wouldn't even connect (as opposed to refusing us, where
  // deeper pages sometimes still load), pages beneath it won't either, and
  // trying each with retries only makes the visitor wait. Go straight to the
  // research fallback.
  const skipFetches = probe.reachability === "unreachable";
  const unavailableFetches: [Awaited<ReturnType<typeof fetchSnapshotPricingText>>, SnapshotHiring] = [
    { status: "unavailable" },
    { status: "unavailable" },
  ];
  // A blocked site's deeper pages usually refuse us too, and each failed page
  // used to burn retries plus an archive lookup (~30s). The research fallback
  // is already running alongside, so give the fetches a shorter leash: what
  // they can read in that time still counts, and the rest is left to research.
  const fetches = () =>
    Promise.all([
      fetchSnapshotPricingText(domain, discovered.pricingUrl),
      fetchSnapshotHiring(domain, discovered.careersUrl),
    ]);
  const [pricingFetch, hiring] = skipFetches
    ? unavailableFetches
    : wantsResearch
      ? ((await withTimeout(fetches(), BLOCKED_FETCH_BUDGET_MS)) ?? unavailableFetches)
      : await fetches();

  let pricing: SnapshotResult["pricing"] = {
    state: home ? "no_page" : "unreachable",
    billingModel: null,
    tiers: [],
    source: null,
    capturedAt: null,
  };

  if (pricingFetch.status === "ok" && !llmAllowed) {
    pricing = { ...pricing, state: "unreadable", source: pricingFetch.source, capturedAt: pricingFetch.capturedAt };
  } else if (pricingFetch.status === "ok") {
    try {
      const extracted = await extractPricingStructure(pricingFetch.text, accountId);
      const hasNumbers = extracted.tiers.some((t) => t.price !== null);
      const state: SnapshotPricingState = hasNumbers
        ? "public"
        : extracted.publiclyPriced
          ? "public_no_numbers"
          : "sales_led";
      pricing = {
        state,
        billingModel: extracted.billingModel,
        tiers: extracted.tiers,
        source: pricingFetch.source,
        capturedAt: pricingFetch.capturedAt,
      };
    } catch (err) {
      // Extraction failing on a page we did read is our problem, not the
      // visitor's: keep the state honest ("couldn't read it") and let the
      // manual-check alert below cover it.
      console.error(`snapshot pricing extraction failed for ${domain}:`, err);
      pricing = { ...pricing, state: "unreadable", source: pricingFetch.source, capturedAt: pricingFetch.capturedAt };
    }
  }

  const answeredPricing = pricing.state === "public" || pricing.state === "public_no_numbers" || pricing.state === "sales_led";
  const answeredHiring = hiring.status === "ok";

  // Drop anything that's really the same site (a redirect between endings) or
  // has the same title, and cap the list: it's a hint, not a directory.
  const mainHost = home ? new URL(home.finalUrl).hostname.replace(/^www\./, "") : null;
  const seenAlternates = new Set<string>();
  const alternates = [...(await typoPromise), ...(await alternatesPromise)]
    .filter((alt) => alt.host !== mainHost && alt.title.toLowerCase() !== (home?.title ?? "").toLowerCase())
    .filter((alt) => (seenAlternates.has(alt.domain) ? false : (seenAlternates.add(alt.domain), true)))
    .slice(0, 3)
    .map(({ domain: altDomain, title }) => ({ domain: altDomain, title }));

  // Couldn't answer either question by reading the site: use the search of
  // public sources rather than giving up to a manual follow-up. For a
  // blocked/unreachable homepage it was started above and overlapped with the
  // fetches (its result is ignored if they answered after all); otherwise it
  // runs here.
  let research: PublicResearch | null = null;
  if (wantsResearch) {
    const result = await researchPromise;
    if (!answeredPricing && !answeredHiring) research = result;
    if (!result) console.info(`snapshot research for ${domain} returned nothing after ${Date.now() - researchStartedAt}ms`);
  } else if (researchAllowed && !answeredPricing && !answeredHiring) {
    // The site loaded but neither its pricing nor its jobs could be read
    // (typically JavaScript-rendered pages): nothing was started in parallel,
    // so run the search now.
    research = await runResearch();
  }

  return {
    domain,
    reachable: home !== null || pricingFetch.status === "ok" || hiring.status !== "unavailable",
    title: home?.title ?? null,
    pricing,
    hiring,
    reachability: probe.reachability,
    research,
    alternates,
    readDirectly: answeredPricing || answeredHiring,
    // (Domains that don't exist or are placeholders returned early above, so
    // anything reaching here that we still couldn't answer, even by searching
    // public sources, genuinely needs a person.)
    needsManualCheck: !answeredPricing && !answeredHiring && !research,
  };
}

// One row per lookup, kept on the lead so a prospect who tries several
// competitors is recorded for all of them, not just the first.
export type SnapshotLookup = {
  domain: string;
  at: string;
  title: string | null;
  pricingState: SnapshotPricingState;
  billingModel: BillingModel | null;
  cheapestPrice: number | null;
  cheapestPeriod: string | null;
  hiringState: SnapshotHiring["status"];
  openRoles: number | null;
  // Optional: rows recorded before these existed don't have them.
  reachability?: SnapshotReachability;
  researchUsed?: boolean;
  needsManualCheck: boolean;
};

const MAX_LOOKUPS_PER_LEAD = 25;

export function toLookup(result: SnapshotResult, at: string = new Date().toISOString()): SnapshotLookup {
  const cheapest = result.pricing.tiers.find((t) => t.price !== null) ?? null;
  return {
    domain: result.domain,
    at,
    title: result.title,
    pricingState: result.pricing.state,
    billingModel: result.pricing.billingModel,
    cheapestPrice: cheapest?.price ?? null,
    cheapestPeriod: cheapest?.price_period ?? null,
    hiringState: result.hiring.status,
    openRoles: result.hiring.status === "ok" ? result.hiring.openRoles : null,
    reachability: result.reachability,
    researchUsed: result.research !== null,
    needsManualCheck: result.needsManualCheck,
  };
}

// Before this existed a lead only ever had the fields of its first lookup:
// rows written by the old route carry a flat `domain` (plus title/pricing
// fields) instead of a lookups array, so that shape is folded in as the
// first lookup rather than lost.
export function existingLookups(
  capturePoint: string | null,
  metadata: Record<string, unknown> | null
): SnapshotLookup[] {
  if (!metadata) return [];
  if (Array.isArray(metadata.snapshotLookups)) return metadata.snapshotLookups as SnapshotLookup[];
  if (capturePoint === "snapshot" && typeof metadata.domain === "string") {
    const tier = metadata.pricingCheapestTier as { price?: number | null; price_period?: string | null } | null;
    const billingModel = (metadata.pricingBillingModel as BillingModel | null) ?? null;
    return [
      {
        domain: metadata.domain,
        at: "",
        title: typeof metadata.title === "string" ? metadata.title : null,
        pricingState:
          tier?.price != null ? "public" : billingModel === "custom" ? "sales_led" : billingModel ? "public_no_numbers" : "unreachable",
        billingModel,
        cheapestPrice: tier?.price ?? null,
        cheapestPeriod: tier?.price_period ?? null,
        hiringState: "unavailable",
        openRoles: null,
        needsManualCheck: false,
      },
    ];
  }
  return [];
}

export function mergeLookup(
  capturePoint: string | null,
  metadata: Record<string, unknown> | null,
  lookup: SnapshotLookup
): Record<string, unknown> {
  const lookups = [...existingLookups(capturePoint, metadata), lookup].slice(-MAX_LOOKUPS_PER_LEAD);
  return { ...(metadata ?? {}), snapshotLookups: lookups };
}

type AdminClient = SupabaseClient<Database>;

// Captured regardless of whether the live fetch succeeded: some sites block
// automated requests, and that's still a real visitor worth having. Which
// domains they checked (and what we found) is what turns a bare email into a
// lead worth prioritizing. A repeat email no longer drops the new lookup:
// the row is kept as-is (capture point, UTMs and date stay first-touch) and
// the lookup is appended to its metadata.
export async function recordSnapshotLead(
  supabase: AdminClient,
  input: { email: string; utmSource: string; utmMedium: string; utmCampaign: string; lookup: SnapshotLookup }
): Promise<string | null> {
  const { email, utmSource, utmMedium, utmCampaign, lookup } = input;

  const { data: inserted, error: insertError } = await supabase
    .from("leads")
    .insert({
      email,
      utm_source: utmSource || null,
      utm_medium: utmMedium || null,
      utm_campaign: utmCampaign || null,
      capture_point: "snapshot",
      metadata: { snapshotLookups: [lookup] },
    })
    .select("id")
    .single();
  if (!insertError) return inserted.id;

  if (insertError.code !== "23505") {
    console.error("snapshot lead insert failed:", insertError);
    return null;
  }

  // leads.email is unique and case-sensitive at the column level, so match
  // the way the insert would have collided.
  const { data: existing, error: selectError } = await supabase
    .from("leads")
    .select("id, capture_point, metadata")
    .eq("email", email)
    .maybeSingle();
  if (selectError || !existing) {
    console.error("snapshot lead lookup after duplicate failed:", selectError);
    return null;
  }

  const { error: updateError } = await supabase
    .from("leads")
    .update({ metadata: mergeLookup(existing.capture_point, existing.metadata, lookup) })
    .eq("id", existing.id);
  if (updateError) console.error("snapshot lead lookup merge failed:", updateError);
  return existing.id;
}

export type DomainCheck = {
  reachability: SnapshotReachability;
  title: string | null;
  alternates: { domain: string; title: string }[];
};

// The quick half of a snapshot (does this domain load, and is there a closer
// match?) without the pricing/hiring/research work, for flows that just need
// to sanity-check a domain a person typed, like a customer adding a
// competitor.
export async function checkDomain(domain: string): Promise<DomainCheck> {
  const probe = await probeSnapshotHomepage(domain);
  const home = probe.page;
  const dead = probe.reachability === "no_such_site" || probe.reachability === "placeholder";
  const [tldAlternates, typoAlternates] = await Promise.all([
    fetchSnapshotAlternates(domain),
    dead || (!home && probe.reachability !== "blocked") ? fetchSnapshotTypoAlternates(domain) : Promise.resolve([]),
  ]);

  const mainHost = home ? new URL(home.finalUrl).hostname.replace(/^www\./, "") : null;
  const seen = new Set<string>();
  const alternates = [...typoAlternates, ...tldAlternates]
    .filter((alt) => alt.host !== mainHost && alt.title.toLowerCase() !== (home?.title ?? "").toLowerCase())
    .filter((alt) => (seen.has(alt.domain) ? false : (seen.add(alt.domain), true)))
    .slice(0, 3)
    .map(({ domain: altDomain, title }) => ({ domain: altDomain, title }));

  return { reachability: probe.reachability, title: home?.title ?? null, alternates };
}
