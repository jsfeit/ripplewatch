import "server-only";
import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  summarizePricingChange,
  summarizeProductChange,
  extractPricingStructure,
  searchCompetitorNews,
  filterRelevantHeadlines,
  canonicalizeHeadlines,
} from "@/lib/anthropic";
import { normalizeDomain, guessPricingUrl, guessCareersUrl } from "@/lib/domain";
import { fetchDomainTrafficMetrics } from "@/lib/seo-data";
import { fetchProductHuntLaunches } from "@/lib/producthunt-data";

type Competitor = Database["public"]["Tables"]["competitors"]["Row"];
type Signal = Database["public"]["Tables"]["signals"]["Row"];
type AdminClient = SupabaseClient<Database>;

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "RipplewatchBot/1.0 (+https://ripplewatch.ai)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}): ${url}`);
  return res.text();
}

// Heuristic-only, no LLM call: fetches the competitor's homepage once and
// scans its links for pricing/careers-shaped text or hrefs. Free and fast,
// but a heuristic — it can miss a pricing page that's JS-rendered, behind a
// "Get a quote" CTA with no matching keyword, or linked from somewhere the
// homepage doesn't surface. Falls back to the plain https://{domain}/pricing
// guess (guessPricingUrl/guessCareersUrl) whenever the homepage fetch fails
// or nothing matches — never leaves a competitor with no URL at all.
const PRICING_LINK_PATTERN = /\bpricing\b|\bplans?\b/i;
const CAREERS_LINK_PATTERN = /\bcareers?\b|\bjobs?\b|\bhiring\b|join[- ]us/i;
const DISCOVERY_TIMEOUT_MS = 6_000;

export async function discoverCompetitorUrls(
  domain: string
): Promise<{ pricingUrl: string | null; careersUrl: string | null }> {
  const fallback = { pricingUrl: guessPricingUrl(domain), careersUrl: guessCareersUrl(domain) };
  const clean = normalizeDomain(domain);
  if (!clean) return fallback;

  let html: string;
  let baseUrl: string;
  try {
    const res = await fetch(`https://${clean}`, {
      headers: { "User-Agent": "RipplewatchBot/1.0 (+https://ripplewatch.ai)" },
      signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
    });
    if (!res.ok) return fallback;
    html = await res.text();
    baseUrl = res.url;
  } catch {
    return fallback;
  }

  const $ = cheerio.load(html);
  let pricingUrl: string | null = null;
  let careersUrl: string | null = null;

  $("a[href]").each((_, el) => {
    if (pricingUrl && careersUrl) return false;
    const href = $(el).attr("href");
    if (!href) return;
    const haystack = `${$(el).text()} ${href}`.toLowerCase();

    if (!pricingUrl && PRICING_LINK_PATTERN.test(haystack)) {
      try {
        pricingUrl = new URL(href, baseUrl).toString();
      } catch {
        // malformed href — skip
      }
    }
    if (!careersUrl && CAREERS_LINK_PATTERN.test(haystack)) {
      try {
        careersUrl = new URL(href, baseUrl).toString();
      } catch {
        // malformed href — skip
      }
    }
  });

  return { pricingUrl: pricingUrl ?? fallback.pricingUrl, careersUrl: careersUrl ?? fallback.careersUrl };
}

// Self-heals a competitor stuck with no pricing_url/careers_url — e.g. one
// added without a domain at the time (discoverCompetitorUrls was never
// called, since the add routes only call it when a domain is present), so
// it silently never gets checked by checkPricingDiff/checkPricingStructure/
// checkJobPostingsDiff (all of which just no-op when the URL is null) —
// forever, since nothing else ever revisits it. Runs once per crawl, cheap
// no-op when both URLs are already set or there's still no domain to guess
// from.
export async function ensureMonitoringUrls(supabase: AdminClient, competitor: Competitor): Promise<Competitor> {
  if ((competitor.pricing_url && competitor.careers_url) || !competitor.domain) return competitor;

  const { pricingUrl, careersUrl } = await discoverCompetitorUrls(competitor.domain);
  const patch: { pricing_url?: string | null; careers_url?: string | null } = {};
  if (!competitor.pricing_url && pricingUrl) patch.pricing_url = pricingUrl;
  if (!competitor.careers_url && careersUrl) patch.careers_url = careersUrl;
  if (Object.keys(patch).length === 0) return competitor;

  const { data: updated } = await supabase
    .from("competitors")
    .update(patch)
    .eq("id", competitor.id)
    .select("*")
    .single();

  return updated ?? competitor;
}

async function fetchPageText(url: string): Promise<string> {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

// Heuristic job-listing extraction: careers pages vary wildly in markup, so
// rather than target one site's structure, pull text from elements that
// typically hold a listing (links, list items, sub-headings) and keep the
// ones shaped like a job title. Imprecise by nature — good enough to notice
// "something new got posted," not a guarantee of zero false positives. This
// is the fallback path — see detectAts/fetchAtsJobs below for the precise
// path used whenever a competitor's board runs on a known ATS.
function extractJobListingTitles(html: string): string[] {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, footer, header").remove();

  const candidates = new Set<string>();
  $("a, li, h2, h3, h4").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length >= 4 && text.length <= 80 && /[a-zA-Z]/.test(text)) {
      candidates.add(text);
    }
  });

  return Array.from(candidates).sort();
}

// A handful of ATS platforms cover most startups (Ripplewatch's own
// audience), and each publishes a public, unauthenticated JSON feed of its
// job board — a structured read (real title, real department, no HTML
// noise) instead of guessing at markup. A company either links straight to
// one of these (careers_url IS the board) or embeds it on their own domain
// via an iframe/script/link whose src still contains the board's URL —
// checking the raw HTML for these patterns catches both cases with one
// fetch. Order matters only in that the first match wins; a page could in
// theory match more than one pattern (e.g. quoting a competitor's board
// URL in body copy), but that's rare enough not to guard against.
export type AtsJob = { title: string; department: string | null };
type AtsProvider = "greenhouse" | "lever" | "ashby" | "workable" | "smartrecruiters";
type AtsDetection = { provider: AtsProvider; boardToken: string };

const ATS_PATTERNS: { provider: AtsProvider; regex: RegExp }[] = [
  { provider: "greenhouse", regex: /(?:boards|job-boards)\.greenhouse\.io\/([a-zA-Z0-9-]+)/ },
  { provider: "lever", regex: /jobs\.lever\.co\/([a-zA-Z0-9-]+)/ },
  { provider: "ashby", regex: /jobs\.ashbyhq\.com\/([a-zA-Z0-9-]+)/ },
  { provider: "workable", regex: /apply\.workable\.com\/([a-zA-Z0-9-]+)/ },
  { provider: "smartrecruiters", regex: /careers\.smartrecruiters\.com\/([a-zA-Z0-9-]+)/ },
];

function detectAts(careersUrl: string, html: string): AtsDetection | null {
  for (const haystack of [careersUrl, html]) {
    for (const { provider, regex } of ATS_PATTERNS) {
      const match = haystack.match(regex);
      if (match) return { provider, boardToken: match[1] };
    }
  }
  return null;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`ATS API fetch failed (${res.status}): ${url}`);
  return res.json();
}

// One fetcher per provider, each mapped to the same {title, department}
// shape — the API responses genuinely differ (Lever nests categories,
// Greenhouse gives an array of department objects, etc.), so this is where
// that gets normalized away. Any parse failure (a schema change on their
// end, an empty/private board) falls back to the generic scrape rather
// than taking the whole crawl down — see the try/catch in checkJobPostingsDiff.
async function fetchAtsJobs({ provider, boardToken }: AtsDetection): Promise<AtsJob[]> {
  switch (provider) {
    case "greenhouse": {
      // The plain jobs list never includes a department (confirmed against
      // several real boards) — department membership is only exposed via a
      // separate endpoint, keyed the other way around (each department
      // lists its own job ids), so build a job-id -> department map from
      // that instead of trusting a field that isn't actually there.
      const [jobsData, departmentsData] = await Promise.all([
        fetchJson(`https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs`) as Promise<{
          jobs?: { id: number; title: string }[];
        }>,
        fetchJson(`https://boards-api.greenhouse.io/v1/boards/${boardToken}/departments`).catch(() => null) as Promise<{
          departments?: { name: string; jobs?: { id: number }[] }[];
        } | null>,
      ]);

      const departmentByJobId = new Map<number, string>();
      for (const department of departmentsData?.departments ?? []) {
        for (const job of department.jobs ?? []) {
          departmentByJobId.set(job.id, department.name);
        }
      }

      return (jobsData.jobs ?? []).map((j) => ({ title: j.title, department: departmentByJobId.get(j.id) ?? null }));
    }
    case "lever": {
      const data = (await fetchJson(`https://api.lever.co/v0/postings/${boardToken}?mode=json`)) as {
        text: string;
        categories?: { team?: string; department?: string };
      }[];
      return (Array.isArray(data) ? data : []).map((j) => ({
        title: j.text,
        department: j.categories?.team ?? j.categories?.department ?? null,
      }));
    }
    case "ashby": {
      const data = (await fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${boardToken}`)) as {
        jobs?: { title: string; department?: string; team?: string }[];
      };
      return (data.jobs ?? []).map((j) => ({ title: j.title, department: j.department ?? j.team ?? null }));
    }
    case "workable": {
      const data = (await fetchJson(
        `https://apply.workable.com/api/v1/widget/accounts/${boardToken}?details=true`
      )) as { jobs?: { title: string; department?: string }[] };
      return (data.jobs ?? []).map((j) => ({ title: j.title, department: j.department ?? null }));
    }
    case "smartrecruiters": {
      const data = (await fetchJson(
        `https://api.smartrecruiters.com/v1/companies/${boardToken}/postings`
      )) as { content?: { name: string; department?: { label: string } }[] };
      return (data.content ?? []).map((j) => ({ title: j.name, department: j.department?.label ?? null }));
    }
  }
}

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

// Keyword-only, deliberately not an LLM call — this runs on every title in
// every crawl, and a rough department split is worth having for free far
// more than a precise one is worth paying for. First match wins, in this
// order, so a title like "Engineering Recruiter" lands in People/HR (the
// more specific signal) rather than Engineering.
const DEPARTMENT_PATTERNS: [string, RegExp][] = [
  ["People/HR", /recruit|talent acquisition|\bhr\b|people ops|people partner/i],
  ["Engineering", /engineer|developer|\bswe\b|devops|\bsre\b|architect|qa\b|infrastructure/i],
  ["Product", /product manager|\bpm\b|product owner|product design/i],
  ["Design", /designer|\bux\b|\bui\b/i],
  ["Sales", /sales|account executive|\bae\b|\bsdr\b|\bbdr\b|business development/i],
  ["Marketing", /marketing|brand|content|growth|demand gen/i],
  ["Customer Success", /customer success|customer support|\bcs\b\W|support engineer/i],
  ["Operations", /operations|\bops\b/i],
  ["Finance", /finance|accounting|controller/i],
  ["Legal", /legal|counsel|compliance/i],
];

function categorizeTitle(title: string): string {
  for (const [department, pattern] of DEPARTMENT_PATTERNS) {
    if (pattern.test(title)) return department;
  }
  return "Other";
}

type SnapshotKind = "pricing" | "jobs" | "producthunt" | "websearch" | "homepage";

async function readSnapshot(supabase: AdminClient, competitorId: string, kind: SnapshotKind) {
  const { data } = await supabase
    .from("page_snapshots")
    .select("*")
    .eq("competitor_id", competitorId)
    .eq("kind", kind)
    .maybeSingle();
  return data;
}

async function writeSnapshot(
  supabase: AdminClient,
  competitorId: string,
  kind: SnapshotKind,
  text: string
) {
  await supabase.from("page_snapshots").upsert(
    {
      competitor_id: competitorId,
      kind,
      content_hash: hashText(text),
      raw_text: text.slice(0, 20_000),
      captured_at: new Date().toISOString(),
    },
    { onConflict: "competitor_id,kind" }
  );
}

// Wayback Machine's "available" API — free, no key required. Used only on a
// competitor's very first pricing check below, when there's no snapshot of
// our own yet to diff against (checkPricingDiff would otherwise just
// silently no-op on that first run). Gives a genuinely new competitor one
// real "here's how this changed" signal by comparing today's page against
// whatever Wayback happened to archive ~6 months back, instead of leaving
// pricing history blank until our second crawl ever produces a diff.
const WAYBACK_LOOKBACK_DAYS = 180;

async function fetchWaybackSnapshotText(url: string): Promise<{ text: string; capturedAt: string } | null> {
  const target = new Date();
  target.setUTCDate(target.getUTCDate() - WAYBACK_LOOKBACK_DAYS);
  const timestamp = target.toISOString().slice(0, 10).replace(/-/g, "");

  let availability: { archived_snapshots?: { closest?: { available: boolean; url: string; timestamp: string } } };
  try {
    const res = await fetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(url)}&timestamp=${timestamp}`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return null;
    availability = await res.json();
  } catch {
    return null;
  }

  const snapshot = availability.archived_snapshots?.closest;
  if (!snapshot?.available || !snapshot.url) return null;

  try {
    const text = await fetchPageText(snapshot.url);
    return { text, capturedAt: snapshot.timestamp };
  } catch {
    // Archived pages are often stale/broken (dead relative links, JS-era
    // markup) — fail quietly here, same stance as the rest of this file's
    // network calls, rather than let a bad archive snapshot break the crawl.
    return null;
  }
}

// Fetches a competitor's pricing page ONCE per crawl run — checkPricingDiff
// and checkPricingStructure both need the current page text, and
// previously each called fetchPageText independently, doubling outbound
// requests (and 403/bot-block risk) per competitor per crawl for no
// reason. Callers share one in-flight promise (see runCrawlForAccount) so
// this only runs once; null means "couldn't load," not "no pricing URL"
// (that's checked separately by each caller).
export async function fetchCompetitorPricingText(competitor: Competitor): Promise<string | null> {
  if (!competitor.pricing_url) return null;
  try {
    return await fetchPageText(competitor.pricing_url);
  } catch (err) {
    console.error(`pricing page unreachable for ${competitor.name} (${competitor.pricing_url}):`, err);
    return null;
  }
}

// Pricing/site diff — compares today's page text against the last crawl,
// then asks Claude what specifically changed so the signal is a concrete
// claim ("entry tier dropped to $69/mo") rather than "something changed."
// Trivial changes (timestamps, copy tweaks) are filtered out entirely.
export async function checkPricingDiff(
  supabase: AdminClient,
  competitor: Competitor,
  pageText: string | null
): Promise<Signal | null> {
  if (!competitor.pricing_url || pageText === null) return null;

  const newText = pageText;
  const existing = await readSnapshot(supabase, competitor.id, "pricing");
  const newHash = hashText(newText);
  await writeSnapshot(supabase, competitor.id, "pricing", newText);

  if (!existing) {
    const past = await fetchWaybackSnapshotText(competitor.pricing_url);
    if (!past) return null;

    const diff = await summarizePricingChange(past.text, newText, competitor.account_id);
    if (!diff.meaningful || !diff.summary) return null;

    const capturedDate = `${past.capturedAt.slice(0, 4)}-${past.capturedAt.slice(4, 6)}-${past.capturedAt.slice(6, 8)}`;
    const { data } = await supabase
      .from("signals")
      .insert({
        competitor_id: competitor.id,
        type: "pricing",
        title: diff.summary,
        summary: `Detected on ${competitor.name}'s pricing page, compared against a Wayback Machine snapshot from ${capturedDate}.`,
        scored: false,
        source: "backfill",
      })
      .select("*")
      .single();

    return data;
  }

  if (existing.content_hash === newHash) return null;

  const diff = await summarizePricingChange(existing.raw_text ?? "", newText, competitor.account_id);
  if (!diff.meaningful || !diff.summary) return null;

  const { data } = await supabase
    .from("signals")
    .insert({
      competitor_id: competitor.id,
      type: "pricing",
      title: diff.summary,
      summary: `Detected on ${competitor.name}'s pricing page.`,
      scored: false,
      source: "pipeline",
    })
    .select("*")
    .single();

  return data;
}

// Structured current-state pricing (tiers, features, billing model) — runs
// alongside checkPricingDiff on every crawl regardless of whether anything
// changed, since the Pricing dashboard needs the full current snapshot, not
// just deltas. Overwrites the one row per competitor rather than keeping
// history — history already lives in the "pricing" signals from
// checkPricingDiff above.
export async function checkPricingStructure(
  supabase: AdminClient,
  competitor: Competitor,
  pageText: string | null
): Promise<void> {
  if (!competitor.pricing_url) return;

  if (pageText === null) {
    // Previously a silent no-op — a page that consistently 403s (bot
    // protection on the pricing page, confirmed on several real competitor
    // domains: same block with a real browser User-Agent, so not a UA-string
    // fix) left the competitor stuck showing "Not yet checked" forever, with
    // nothing in the logs to explain why. fetchCompetitorPricingText already
    // logged the fetch failure; an honest record is written here so the UI
    // can say "couldn't check automatically" instead of implying a check
    // just hasn't happened yet.
    await supabase.from("competitor_pricing").upsert(
      {
        competitor_id: competitor.id,
        billing_model: "unknown",
        publicly_priced: false,
        note: "Couldn't load this pricing page automatically (it blocks automated requests): check it directly.",
        tiers: [],
        last_checked_at: new Date().toISOString(),
      },
      { onConflict: "competitor_id" }
    );
    return;
  }

  let extraction;
  try {
    extraction = await extractPricingStructure(pageText, competitor.account_id);
  } catch (err) {
    // The page loaded fine — this is an Anthropic-side failure (an outage,
    // exhausted credits), not a scraping problem. Distinct from the fetch
    // failure above: leaves the existing competitor_pricing row alone
    // rather than overwriting good data with an "unknown" placeholder just
    // because this one run's LLM call failed. crawl.ts's own catch around
    // this function keeps this from taking the rest of the account's
    // recrawl down with it.
    console.error(`pricing structure extraction failed for ${competitor.name}:`, err);
    return;
  }

  await supabase.from("competitor_pricing").upsert(
    {
      competitor_id: competitor.id,
      billing_model: extraction.billingModel,
      publicly_priced: extraction.publiclyPriced,
      note: extraction.note,
      tiers: extraction.tiers,
      last_checked_at: new Date().toISOString(),
    },
    { onConflict: "competitor_id" }
  );
}

// Job postings — extracts individual listing titles and diffs the set,
// rather than hashing the whole page, so the signal names the actual new
// role(s) instead of just flagging that the page changed.
export async function checkJobPostingsDiff(
  supabase: AdminClient,
  competitor: Competitor
): Promise<Signal | null> {
  if (!competitor.careers_url) return null;

  const html = await fetchHtml(competitor.careers_url);
  const detection = detectAts(competitor.careers_url, html);

  // ATS jobs win when detection succeeds and the API actually returns
  // something — a private/empty board or a schema change on their end
  // falls back to the generic scrape rather than reporting zero roles as
  // if that were a real reading.
  let atsJobs: AtsJob[] = [];
  if (detection) {
    try {
      atsJobs = await fetchAtsJobs(detection);
    } catch (err) {
      console.error(`ATS API fetch failed for ${competitor.name} (${detection.provider}):`, err);
    }
  }
  const usingAts = atsJobs.length > 0;

  const titles = usingAts ? atsJobs.map((j) => j.title) : extractJobListingTitles(html);
  const joined = titles.join("\n");
  const existing = await readSnapshot(supabase, competitor.id, "jobs");
  const newHash = hashText(joined);
  await writeSnapshot(supabase, competitor.id, "jobs", joined);

  // Real department field from the ATS when we have one; a job it left
  // blank (or the generic-scrape path, which never has one) still gets a
  // best-guess department from the title, so the breakdown is never just
  // "everything's Other" because a couple of postings had no metadata.
  const breakdown: Record<string, number> = {};
  for (const [title, department] of usingAts
    ? atsJobs.map((j): [string, string | null] => [j.title, j.department])
    : titles.map((t): [string, string | null] => [t, null])) {
    const bucket = department ?? categorizeTitle(title);
    breakdown[bucket] = (breakdown[bucket] ?? 0) + 1;
  }

  // Current-state reading (open role count + department mix), same "always
  // update, regardless of whether a diff signal fires" behavior as
  // competitor_pricing/competitor_seo above — this is a snapshot table, not
  // an event log, so it should reflect what's on the page right now even on
  // a run with zero new listings.
  await supabase.from("competitor_hiring").upsert(
    {
      competitor_id: competitor.id,
      open_role_count: titles.length,
      department_breakdown: breakdown,
      source: usingAts ? detection!.provider : null,
      last_checked_at: new Date().toISOString(),
    },
    { onConflict: "competitor_id" }
  );

  if (!existing) return null;
  if (existing.content_hash === newHash) return null;

  const previousTitles = new Set((existing.raw_text ?? "").split("\n").filter(Boolean));
  const newTitles = titles.filter((t) => !previousTitles.has(t));
  if (newTitles.length === 0) return null;

  const shown = newTitles.slice(0, 5);
  const summary =
    shown.join("; ") + (newTitles.length > shown.length ? ` (+${newTitles.length - shown.length} more)` : "");

  const { data } = await supabase
    .from("signals")
    .insert({
      competitor_id: competitor.id,
      type: "job_posting",
      title: `${competitor.name} posted ${newTitles.length} new job listing${newTitles.length === 1 ? "" : "s"}`,
      summary,
      scored: false,
      source: "pipeline",
    })
    .select("*")
    .single();

  return data;
}

// Homepage positioning/feature changes — same hash-then-LLM-diff shape as
// checkPricingDiff, but reads the competitor's homepage instead of a
// dedicated pricing page (competitor.domain already gives the root, so
// there's no URL to discover/guess first). No Wayback backfill on the
// first check, unlike pricing: a homepage redesign from 6 months ago is
// much more likely to just be noise (full visual/copy overhaul) than a
// genuinely new positioning claim, so the first check only seeds the
// snapshot — same stance as checkJobPostingsDiff.
//
// Weekly-gated like SEO/Product Hunt above, unlike pricing/jobs which
// check every crawl: a homepage carries far more incidental churn between
// crawls than a pricing or careers page (rotating testimonials, "N
// companies signed up today" counters, A/B-tested hero copy) — checking
// daily would burn a Claude call per competitor per day mostly on noise
// the LLM just ends up discarding as not meaningful.
const HOMEPAGE_CHECK_INTERVAL_DAYS = 7;

export async function checkProductMessagingDiff(supabase: AdminClient, competitor: Competitor): Promise<Signal | null> {
  const clean = normalizeDomain(competitor.domain ?? "");
  if (!clean) return null;
  const homepageUrl = `https://${clean}`;

  const existing = await readSnapshot(supabase, competitor.id, "homepage");
  if (existing) {
    const daysSinceCheck = (Date.now() - new Date(existing.captured_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCheck < HOMEPAGE_CHECK_INTERVAL_DAYS) return null;
  }

  let newText: string;
  try {
    newText = await fetchPageText(homepageUrl);
  } catch (err) {
    console.error(`homepage unreachable for ${competitor.name} (${homepageUrl}):`, err);
    return null;
  }

  const newHash = hashText(newText);
  await writeSnapshot(supabase, competitor.id, "homepage", newText);

  if (!existing) return null;
  if (existing.content_hash === newHash) return null;

  const diff = await summarizeProductChange(existing.raw_text ?? "", newText, competitor.account_id);
  if (!diff.meaningful || !diff.summary) return null;

  const { data } = await supabase
    .from("signals")
    .insert({
      competitor_id: competitor.id,
      type: "product_change",
      title: diff.summary,
      summary: `Detected on ${competitor.name}'s homepage.`,
      url: homepageUrl,
      scored: false,
      source: "pipeline",
    })
    .select("*")
    .single();

  return data;
}

// Product Hunt launches — free API (once a real token replaces the stub, see
// producthunt-data.ts), checked weekly via the same captured_at-age gate as
// checkSearchNews below, and diffed the same hash-then-compare way as job
// postings: no dedicated last-checked column, page_snapshots' captured_at
// already carries "when did we last check this."
const PRODUCTHUNT_CHECK_INTERVAL_DAYS = 7;

export async function checkProductHuntLaunches(supabase: AdminClient, competitor: Competitor): Promise<Signal[]> {
  const existing = await readSnapshot(supabase, competitor.id, "producthunt");
  if (existing) {
    const daysSinceCheck = (Date.now() - new Date(existing.captured_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCheck < PRODUCTHUNT_CHECK_INTERVAL_DAYS) return [];
  }

  const launches = await fetchProductHuntLaunches(competitor.name);
  const joined = launches.map((l) => `${l.title} — ${l.tagline}`).join("\n");
  const newHash = hashText(joined);
  await writeSnapshot(supabase, competitor.id, "producthunt", joined);

  // First-ever check just seeds the snapshot — nothing to diff against yet,
  // and (unlike the Wayback pricing backfill) there's no historical Product
  // Hunt archive worth reaching for here, so this stays a plain seed.
  if (!existing) return [];
  if (existing.content_hash === newHash) return [];

  const previousEntries = new Set((existing.raw_text ?? "").split("\n").filter(Boolean));
  const newLaunches = launches.filter((l) => !previousEntries.has(`${l.title} — ${l.tagline}`));
  if (newLaunches.length === 0) return [];

  const inserted: Signal[] = [];
  for (const launch of newLaunches) {
    const { data } = await supabase
      .from("signals")
      .insert({
        competitor_id: competitor.id,
        type: "news",
        title: `${competitor.name} launched "${launch.title}" on Product Hunt`,
        summary: launch.tagline,
        url: launch.url,
        scored: false,
        source: "pipeline",
      })
      .select("*")
      .single();
    if (data) inserted.push(data);
  }
  return inserted;
}

// SEO/traffic — checked weekly, not every crawl (see SEO_CHECK_INTERVAL_DAYS):
// once fetchDomainTrafficMetrics is backed by a real provider (DataForSEO,
// per src/lib/seo-data.ts) each call carries a real per-query cost, and
// traffic/ranking data doesn't meaningfully move faster than this anyway.
// Structured metrics in, not raw page text — diffed as plain numbers
// against the last competitor_seo row rather than a page_snapshots hash.
const SEO_CHECK_INTERVAL_DAYS = 7;
const SEO_MEANINGFUL_CHANGE_PCT = 20;

async function readSeoSnapshot(supabase: AdminClient, competitorId: string) {
  const { data } = await supabase.from("competitor_seo").select("*").eq("competitor_id", competitorId).maybeSingle();
  return data;
}

export async function checkSeoTrafficDiff(supabase: AdminClient, competitor: Competitor): Promise<Signal | null> {
  if (!competitor.domain) return null;

  const existing = await readSeoSnapshot(supabase, competitor.id);
  if (existing) {
    const daysSinceCheck = (Date.now() - new Date(existing.last_checked_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCheck < SEO_CHECK_INTERVAL_DAYS) return null;
  }

  const metrics = await fetchDomainTrafficMetrics(competitor.domain);
  if (!metrics) return null;

  await supabase.from("competitor_seo").upsert(
    {
      competitor_id: competitor.id,
      organic_traffic_estimate: metrics.organicTrafficEstimate,
      traffic_trend: metrics.trafficTrend,
      top_keywords: metrics.topKeywords,
      last_checked_at: new Date().toISOString(),
    },
    { onConflict: "competitor_id" }
  );

  if (!existing || existing.organic_traffic_estimate === null || existing.organic_traffic_estimate === 0) return null;

  const previous = existing.organic_traffic_estimate;
  const current = metrics.organicTrafficEstimate;
  const pctChange = ((current - previous) / previous) * 100;
  if (Math.abs(pctChange) < SEO_MEANINGFUL_CHANGE_PCT) return null;

  const direction = pctChange > 0 ? "up" : "down";
  const { data } = await supabase
    .from("signals")
    .insert({
      competitor_id: competitor.id,
      type: "seo",
      title: `${competitor.name}'s estimated organic traffic is ${direction} ${Math.abs(Math.round(pctChange))}% since the last check`,
      summary: `Estimated organic traffic moved from ~${previous.toLocaleString()} to ~${current.toLocaleString()} monthly visits.`,
      scored: false,
      source: "pipeline",
    })
    .select("*")
    .single();

  return data;
}

// Google News RSS's <description> for search results is usually just the
// headline re-wrapped in a link (sometimes a short list of related
// headlines), not real article body text — so this is a best-effort bump
// over "just the source name," not a full-article summary. Genuinely
// richer content would mean following the redirect to the source site,
// which isn't worth the added fragility/latency in a cron loop for what's
// still just a headline-level signal.
//
// Returns up to `limit` items, not just the top one — a single feed fetch
// commonly has 10+ genuinely distinct stories, and only ever looking at
// item #1 meant nothing new surfaced on a given competitor until Google's
// own ranking happened to change which story was first.
const HEADLINES_PER_QUERY = 8;

async function fetchHeadlines(
  query: string,
  limit: number = HEADLINES_PER_QUERY
): Promise<
  { title: string; source: string | null; description: string | null; link: string | null; publishedAt: string | null }[]
> {
  const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetch(feedUrl, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return [];

  const xml = await res.text();
  const $ = cheerio.load(xml, { xmlMode: true });

  return $("item")
    .slice(0, limit)
    .map((_, el) => {
      const item = $(el);
      const title = item.find("title").text().trim();
      const source = item.find("source").text().trim() || null;
      const link = item.find("link").text().trim() || null;
      const rawDescription = item.find("description").text().trim();
      // Strip the HTML the field is wrapped in and drop it if it's just the
      // title again — only keep it when it actually adds information.
      const cleanDescription = cheerio.load(rawDescription).text().replace(/\s+/g, " ").trim();
      const description =
        cleanDescription && cleanDescription !== title && !cleanDescription.startsWith(title)
          ? cleanDescription
          : null;
      // Google News RSS items carry a real RFC822 pubDate — without this,
      // every signal's occurred_on defaulted to whenever it was inserted,
      // making a months-old article look exactly as fresh as one from
      // today. Stored as an ISO date string; null if missing/unparseable
      // rather than guessing.
      const rawPubDate = item.find("pubDate").text().trim();
      const parsedDate = rawPubDate ? new Date(rawPubDate) : null;
      const publishedAt = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.toISOString().slice(0, 10) : null;
      return { title, source, description, link, publishedAt };
    })
    .get()
    .filter((item) => item.title);
}

// Recent (not all-time) so a genuinely new story that happens to echo
// something from months ago isn't wrongly suppressed — same freshness
// window as isFresh() below, since anything older than that has already
// aged out of "still relevant to compare against" territory anyway.
async function fetchRecentSignalTitles(supabase: AdminClient, competitorId: string): Promise<string[]> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - FRESHNESS_WINDOW_DAYS);
  const { data } = await supabase
    .from("signals")
    .select("title")
    .eq("competitor_id", competitorId)
    .in("type", ["news", "funding"])
    .gte("created_at", cutoff.toISOString());
  return (data ?? []).map((s) => s.title);
}

// Fetched ONCE per checkNews/checkFunding/checkSearchNews call, then
// checked in-memory per headline instead of one Supabase round-trip per
// headline (previously up to HEADLINES_PER_QUERY queries per check, per
// competitor, per crawl — real added crawl latency for no benefit, since
// the whole set fits comfortably in memory). Deliberately unscoped by
// date, unlike fetchRecentSignalTitles's 30-day window above — this is
// the final exact-match guard before insert, checked across both news and
// funding so the same headline never ends up filed under both types, and
// it needs to catch an exact-duplicate title from any point in history,
// not just recent ones.
async function fetchAllSignalTitles(supabase: AdminClient, competitorId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("signals")
    .select("title")
    .eq("competitor_id", competitorId)
    .in("type", ["news", "funding"]);
  return new Set((data ?? []).map((s) => s.title));
}

// True the first time a competitor's news/funding gets checked at all — that
// crawl deliberately allows older articles through (see FRESHNESS_WINDOW_DAYS
// below) to seed real competitive context for a brand-new account, tagged
// "backfill" so it reads as "here's the landscape" rather than "here's what
// just happened." Every check after that is "pipeline" and freshness-filtered.
//
// Callers (checkNews, checkFunding) run concurrently for the same
// competitor in a single crawl — this must be computed ONCE up front (see
// runCrawlForAccount in crawl.ts) and passed to both, not called
// independently by each. Two concurrent callers each checking "is the count
// still zero?" right before their own insert is a classic
// check-then-act race: whichever inserts first makes the other see a
// nonzero count and wrongly conclude it's no longer the first check.
export async function isFirstNewsCheck(supabase: AdminClient, competitorId: string): Promise<boolean> {
  const { count } = await supabase
    .from("signals")
    .select("id", { count: "exact", head: true })
    .eq("competitor_id", competitorId)
    .in("type", ["news", "funding"]);
  return (count ?? 0) === 0;
}

// Google News RSS is a relevance search, not a chronological feed — for a
// quiet competitor, the same months-old article can keep coming back as the
// best match run after run. Ongoing (non-backfill) crawls drop anything
// older than this so old news can't masquerade as a new alert; an item
// without a parseable date is kept rather than dropped (fail open, same
// stance as the other headline filters here).
const FRESHNESS_WINDOW_DAYS = 30;

function isFresh(publishedAt: string | null): boolean {
  if (!publishedAt) return true;
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - FRESHNESS_WINDOW_DAYS);
  return new Date(publishedAt) >= cutoff;
}

// AND-ed onto every news/funding query below so a bare company name that's
// also a common word or unrelated brand ("Sage", "Wave", "Square") doesn't
// pull in sports/entertainment/idiom noise — narrows results to ones that
// actually read as business coverage. Not perfect (won't disambiguate two
// different companies that share a name and both plausibly get called "a
// company"), but eliminates the dominant class of false positives seen in
// practice.
const BUSINESS_CONTEXT_TERMS =
  "(company OR software OR startup OR business OR app OR platform OR product OR pricing OR CEO OR customers)";

// Generic enough to appear in almost any headline regardless of story —
// excluded so token overlap only fires on words that actually distinguish
// one story from another (a partner's name, an acquired company, a
// specific term), not incidental shared phrasing.
const DEDUPE_STOPWORDS = new Set([
  "the", "a", "an", "to", "for", "of", "and", "or", "with", "in", "on", "at", "is", "are", "was", "were",
  "its", "their", "they", "new", "now", "this", "that", "from", "by", "as", "has", "have", "had", "will",
  "would", "can", "could", "into", "over", "after", "than", "more", "most", "some", "all", "just", "about",
  "announces", "announced", "reports", "report", "says", "said", "company", "business", "businesses",
  "customers", "customer", "small",
]);

function significantTokens(title: string, competitorName: string): Set<string> {
  const competitorTokens = new Set(competitorName.toLowerCase().split(/\s+/));
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !DEDUPE_STOPWORDS.has(w) && !competitorTokens.has(w))
  );
}

// Two headlines sharing 2+ specific, non-generic words (beyond the
// competitor's own name) are almost certainly the same underlying story —
// most reliably, a third-party name that shows up in both (a partner, an
// acquired company, an investor). Deterministic, so it doesn't depend on an
// LLM reliably generalizing dedup judgment to every possible headline
// pattern — added after dedupeSameStoryHeadlines (an LLM call, still used
// below for subtler paraphrases with no shared distinctive words) missed
// three real near-duplicates in a row despite worked examples in its
// prompt: "Gusto Acquires Guideline..." vs "Gusto agrees to buy...
// Guideline" (shared: Guideline), "Xero price hike..." vs "Xero raises its
// prices..." (shared: price/prices), "FreshBooks and Grasshopper Partner
// to Streamline..." vs "FreshBooks and Grasshopper Partner to Provide..."
// (shared: Grasshopper, partner, and more).
function sharesSignificantTokens(titleA: string, titleB: string, competitorName: string, minShared = 2): boolean {
  const tokensA = significantTokens(titleA, competitorName);
  const tokensB = significantTokens(titleB, competitorName);
  let shared = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) shared++;
    if (shared >= minShared) return true;
  }
  return false;
}

function dedupeByTokenOverlap<T extends { title: string }>(
  headlines: T[],
  existingTitles: string[],
  competitorName: string
): T[] {
  const kept: T[] = [];
  for (const headline of headlines) {
    const isDuplicate =
      kept.some((k) => sharesSignificantTokens(headline.title, k.title, competitorName)) ||
      existingTitles.some((t) => sharesSignificantTokens(headline.title, t, competitorName));
    if (!isDuplicate) kept.push(headline);
  }
  return kept;
}

// Catches paraphrase duplicates the raw-headline token check above can't —
// two headlines about the same event but with zero shared distinctive words
// (e.g. "Xero price hike has some accountants looking for alternatives" vs
// "Xero raises its prices, compounding the annoyance for investors,
// customers"). Rather than asking an LLM to judge "are these the same
// story" directly on raw headlines — the previous approach, which missed
// three real near-duplicates in a row (Gusto/Guideline, this exact Xero
// case, and a FreshBooks/Grasshopper partnership) despite worked examples —
// this asks a narrower, more mechanical question first: normalize each
// headline into a neutral "what happened" sentence. Same real event should
// canonicalize to near-identical text even when the original headlines
// share no vocabulary; the actual sameness call is then made
// deterministically (same token-overlap check as above, just applied to the
// canonical sentences instead of the raw headlines).
async function dedupeByCanonicalEvent<T extends { title: string; description?: string | null }>(
  headlines: T[],
  existingTitles: string[],
  competitorName: string,
  accountId: string | null
): Promise<T[]> {
  if (headlines.length === 0) return headlines;

  const [canonicalNew, canonicalExisting] = await Promise.all([
    canonicalizeHeadlines(headlines, accountId),
    existingTitles.length > 0 ? canonicalizeHeadlines(existingTitles.map((title) => ({ title })), accountId) : Promise.resolve([]),
  ]);

  const kept: T[] = [];
  const keptCanonical: string[] = [];
  headlines.forEach((headline, i) => {
    const canonical = canonicalNew[i];
    const isDuplicate =
      keptCanonical.some((k) => sharesSignificantTokens(canonical, k, competitorName)) ||
      canonicalExisting.some((c) => sharesSignificantTokens(canonical, c, competitorName));
    if (!isDuplicate) {
      kept.push(headline);
      keptCanonical.push(canonical);
    }
  });
  return kept;
}

// Last line of defense against name collisions the query-level AND above
// can't catch — two genuinely business-shaped entities that share a name
// (a company called "Square" vs. "Union Square Ventures"). One batched LLM
// call per competitor per check, so cost stays bounded regardless of how
// many headlines came back.
async function filterHeadlinesForCompetitor<T extends { title: string; description?: string | null }>(
  supabase: AdminClient,
  competitor: Competitor,
  headlines: T[]
): Promise<(T & { classifiedType: "news" | "funding" })[]> {
  if (headlines.length === 0) return [];
  const classified = await filterRelevantHeadlines(
    competitor.name,
    competitor.domain,
    competitor.category,
    headlines,
    competitor.account_id
  );
  // Reclassified here rather than trusting which query (news vs. funding
  // search) originally found the headline — "raises" matches the funding
  // query whether it means "raised money" or "raised prices," so the query
  // that surfaced a headline isn't a reliable signal of what it's actually
  // about.
  const relevantHeadlines = headlines
    .map((h, i) => ({ ...h, classifiedType: classified[i].type }))
    .filter((_, i) => classified[i].relevant);
  if (relevantHeadlines.length === 0) return relevantHeadlines;

  // Different publishers covering the exact same event (an acquisition, a
  // funding round) otherwise both survive as separate signals and get
  // scored independently — collapse to one per distinct story. Checked
  // against recent existing signals too, not just this batch, so the same
  // event resurfacing in a later crawl run (or via the other check —
  // checkNews/checkFunding now run sequentially per competitor precisely so
  // this sees what the other just inserted) gets caught as well.
  const existingTitles = await fetchRecentSignalTitles(supabase, competitor.id);

  // Deterministic pass first — catches the obvious cases (a shared partner/
  // acquired-company name) cheaply, no LLM call needed, and shrinks what the
  // canonicalization pass below has to process.
  const tokenDeduped = dedupeByTokenOverlap(relevantHeadlines, existingTitles, competitor.name);
  if (tokenDeduped.length === 0) return tokenDeduped;

  return dedupeByCanonicalEvent(tokenDeduped, existingTitles, competitor.name, competitor.account_id);
}

// News — free Google News RSS query, no API key required. De-duped against
// existing signal titles for this competitor rather than a snapshot hash,
// since RSS feeds don't have a stable "page" to diff. Inserts every headline
// from this run that isn't already a signal, not just one.
export async function checkNews(supabase: AdminClient, competitor: Competitor, isFirstCheck: boolean): Promise<Signal[]> {
  const query = `"${competitor.name}" ${BUSINESS_CONTEXT_TERMS}`;
  let headlines = await filterHeadlinesForCompetitor(supabase, competitor, await fetchHeadlines(query));
  if (!isFirstCheck) headlines = headlines.filter((h) => isFresh(h.publishedAt));
  const inserted: Signal[] = [];
  const existingTitles = await fetchAllSignalTitles(supabase, competitor.id);

  for (const headline of headlines) {
    if (existingTitles.has(headline.title)) continue;

    const { data } = await supabase
      .from("signals")
      .insert({
        competitor_id: competitor.id,
        type: headline.classifiedType,
        title: headline.title,
        summary: headline.description ?? headline.source,
        url: headline.link,
        occurred_on: headline.publishedAt ?? undefined,
        scored: false,
        source: isFirstCheck ? "backfill" : "pipeline",
      })
      .select("*")
      .single();

    if (data) {
      inserted.push(data);
      existingTitles.add(headline.title);
    }
  }

  return inserted;
}

// Funding — same free Google News RSS approach, but with a query weighted
// toward funding-announcement language so raises/rounds get classified and
// surfaced distinctly from general news instead of getting buried in it.
export async function checkFunding(supabase: AdminClient, competitor: Competitor, isFirstCheck: boolean): Promise<Signal[]> {
  const query = `"${competitor.name}" (raises OR "seed round" OR "series a" OR "series b" OR "series c" OR funding OR valuation) ${BUSINESS_CONTEXT_TERMS}`;
  let headlines = await filterHeadlinesForCompetitor(supabase, competitor, await fetchHeadlines(query));
  if (!isFirstCheck) headlines = headlines.filter((h) => isFresh(h.publishedAt));
  const inserted: Signal[] = [];
  const existingTitles = await fetchAllSignalTitles(supabase, competitor.id);

  for (const headline of headlines) {
    if (existingTitles.has(headline.title)) continue;

    const { data } = await supabase
      .from("signals")
      .insert({
        competitor_id: competitor.id,
        type: headline.classifiedType,
        title: headline.title,
        summary: headline.description ?? headline.source,
        url: headline.link,
        occurred_on: headline.publishedAt ?? undefined,
        scored: false,
        source: isFirstCheck ? "backfill" : "pipeline",
      })
      .select("*")
      .single();

    if (data) {
      inserted.push(data);
      existingTitles.add(headline.title);
    }
  }

  return inserted;
}

// Supplements checkNews with Claude's web search — costs a per-search fee
// plus notably heavier tokens than the free RSS path (see anthropic.ts),
// so this is gated behind ENABLE_WEB_SEARCH_NEWS and off by default. Not a
// replacement: still de-dupes against the same signal titles checkNews and
// checkFunding already wrote for this run, so the two sources never insert
// the same real story twice.
//
// Weekly-gated even once enabled — same captured_at-age pattern as
// checkProductHuntLaunches above, using a page_snapshots row purely as a
// cadence marker (no diff content, since headlines already dedupe via
// fetchAllSignalTitles). Real per-search + token cost scales with how often
// this runs, not just whether it's on — every crawl would multiply spend
// for no benefit, since competitor news doesn't change hour to hour.
const WEB_SEARCH_NEWS_CHECK_INTERVAL_DAYS = 7;

export async function checkSearchNews(
  supabase: AdminClient,
  competitor: Competitor,
  accountId: string | null
): Promise<Signal[]> {
  const existing = await readSnapshot(supabase, competitor.id, "websearch");
  if (existing) {
    const daysSinceCheck = (Date.now() - new Date(existing.captured_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCheck < WEB_SEARCH_NEWS_CHECK_INTERVAL_DAYS) return [];
  }
  await writeSnapshot(supabase, competitor.id, "websearch", "checked");

  const headlines = await searchCompetitorNews(competitor.name, accountId);
  const inserted: Signal[] = [];
  const existingTitles = await fetchAllSignalTitles(supabase, competitor.id);

  for (const headline of headlines) {
    if (!headline.title) continue;
    if (existingTitles.has(headline.title)) continue;

    const { data } = await supabase
      .from("signals")
      .insert({
        competitor_id: competitor.id,
        type: "news",
        title: headline.title,
        summary: headline.summary,
        url: headline.url,
        scored: false,
        source: "pipeline",
      })
      .select("*")
      .single();

    if (data) {
      inserted.push(data);
      existingTitles.add(headline.title);
    }
  }

  return inserted;
}
