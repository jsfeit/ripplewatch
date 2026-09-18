import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchSnapshotHomepage,
  fetchSnapshotPricingText,
  fetchSnapshotHiring,
  fetchSnapshotAlternates,
  extractDiscoveredUrls,
  type SnapshotHiring,
} from "@/lib/scraping";
import { extractPricingStructure } from "@/lib/anthropic";
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
  // Other sites with the same name on a different domain ending (e.g. arlo.co
  // for arlo.com), so a visitor who typed the wrong one can switch in a
  // click. Empty when there's nothing that looks like a different company.
  alternates: { domain: string; title: string }[];
  // True when we couldn't answer either question automatically. The route
  // alerts the admin so a human can follow up instead of the visitor being
  // left at a dead end.
  needsManualCheck: boolean;
};

export async function buildSnapshot(
  domain: string,
  // False once the day's cap on anonymous LLM calls is reached (see the
  // route): pages are still fetched and hiring still read, but the pricing
  // page isn't sent to Claude, so the visitor gets the manual follow-up path
  // instead of the feature spending without limit.
  opts: { llmAllowed?: boolean } = {}
): Promise<SnapshotResult> {
  const llmAllowed = opts.llmAllowed ?? true;
  // Started first so it runs alongside everything else instead of adding to
  // the visitor's wait.
  const alternatesPromise = fetchSnapshotAlternates(domain);
  const home = await fetchSnapshotHomepage(domain);
  const discovered = home ? extractDiscoveredUrls(home.html, home.finalUrl) : { pricingUrl: null, careersUrl: null };

  const [pricingFetch, hiring] = await Promise.all([
    fetchSnapshotPricingText(domain, discovered.pricingUrl),
    fetchSnapshotHiring(domain, discovered.careersUrl),
  ]);

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
      const extracted = await extractPricingStructure(pricingFetch.text, null);
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
  const alternates = (await alternatesPromise)
    .filter((alt) => alt.host !== mainHost && alt.title.toLowerCase() !== (home?.title ?? "").toLowerCase())
    .slice(0, 3)
    .map(({ domain: altDomain, title }) => ({ domain: altDomain, title }));

  return {
    domain,
    reachable: home !== null || pricingFetch.status === "ok" || hiring.status !== "unavailable",
    title: home?.title ?? null,
    pricing,
    hiring,
    alternates,
    needsManualCheck: !answeredPricing && !answeredHiring,
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
): Promise<void> {
  const { email, utmSource, utmMedium, utmCampaign, lookup } = input;

  const { error: insertError } = await supabase.from("leads").insert({
    email,
    utm_source: utmSource || null,
    utm_medium: utmMedium || null,
    utm_campaign: utmCampaign || null,
    capture_point: "snapshot",
    metadata: { snapshotLookups: [lookup] },
  });
  if (!insertError) return;

  if (insertError.code !== "23505") {
    console.error("snapshot lead insert failed:", insertError);
    return;
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
    return;
  }

  const { error: updateError } = await supabase
    .from("leads")
    .update({ metadata: mergeLookup(existing.capture_point, existing.metadata, lookup) })
    .eq("id", existing.id);
  if (updateError) console.error("snapshot lead lookup merge failed:", updateError);
}
