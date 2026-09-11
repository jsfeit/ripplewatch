import "server-only";
import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  summarizePricingChange,
  summarizeProductChange,
  compareScreenshots,
  extractPricingStructure,
  searchCompetitorNews,
  filterRelevantHeadlines,
  canonicalizeHeadlines,
  discoverReviewUrls,
  extractReviewStats,
  summarizeBuzzSentiment,
  type SignalSentiment,
} from "@/lib/anthropic";
import { normalizeDomain, guessPricingUrl, guessCareersUrl } from "@/lib/domain";
import { fetchProductHuntLaunches } from "@/lib/producthunt-data";
import { fetchGithubCommitVelocity } from "@/lib/github-data";
import { fetchBuzzMentions } from "@/lib/reddit-hn-data";
import { fetchActiveAdCount } from "@/lib/meta-ads-data";
import { captureScreenshot } from "@/lib/screenshot";

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
const CAREERS_LINK_PATTERN =
  /\bcareers?\b|\bjobs?\b|\bhiring\b|join[- ]us|open\s+(?:roles?|positions?)|join\s+(?:the|our)\s+team/i;
// Used by checkChangelogDiff/checkBlogDiff below, not discoverCompetitorUrls
// — unlike pricing/careers, most competitors don't have either page, so
// there's no guessed-URL fallback the way guessPricingUrl/guessCareersUrl
// provide; a homepage link is either found or the check just no-ops.
const CHANGELOG_LINK_PATTERN = /\bchangelog\b|\brelease\s*notes?\b|\bwhat'?s\s*new\b|\bupdates?\s*log\b/i;
const BLOG_LINK_PATTERN = /\bblog\b/i;
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

// A stored URL that fails a few crawls in a row is usually a sign the
// competitor moved or redesigned their site, not a transient blip — after
// URL_FAILURE_REDISCOVER_THRESHOLD consecutive misses, this re-runs the
// same homepage-link discovery used when the URL was first empty
// (discoverCompetitorUrls above) and adopts whatever it finds, but only if
// that's actually different from what's already stored — re-adopting the
// same bad URL would just reset the counter without fixing anything, and
// then fail the same way again next crawl. A single success at any point
// resets the counter to zero rather than requiring N consecutive good
// crawls to "recover."
const URL_FAILURE_REDISCOVER_THRESHOLD = 3;

type CompetitorPatch = Database["public"]["Tables"]["competitors"]["Update"];

async function trackUrlHealth(
  supabase: AdminClient,
  competitor: Competitor,
  kind: "pricing" | "careers",
  success: boolean
): Promise<void> {
  const currentFailures = (kind === "pricing" ? competitor.pricing_fetch_failures : competitor.careers_fetch_failures) ?? 0;

  if (success) {
    if (currentFailures > 0) {
      const patch: CompetitorPatch =
        kind === "pricing" ? { pricing_fetch_failures: 0 } : { careers_fetch_failures: 0 };
      await supabase.from("competitors").update(patch).eq("id", competitor.id);
    }
    return;
  }

  const nextCount = currentFailures + 1;
  const patch: CompetitorPatch =
    kind === "pricing"
      ? { pricing_fetch_failures: nextCount, pricing_last_failed_at: new Date().toISOString() }
      : { careers_fetch_failures: nextCount, careers_last_failed_at: new Date().toISOString() };

  if (nextCount >= URL_FAILURE_REDISCOVER_THRESHOLD && competitor.domain) {
    const rediscovered = await discoverCompetitorUrls(competitor.domain);
    const currentUrl = kind === "pricing" ? competitor.pricing_url : competitor.careers_url;
    const candidate = kind === "pricing" ? rediscovered.pricingUrl : rediscovered.careersUrl;
    if (candidate && candidate !== currentUrl) {
      if (kind === "pricing") {
        patch.pricing_url = candidate;
        patch.pricing_fetch_failures = 0;
      } else {
        patch.careers_url = candidate;
        patch.careers_fetch_failures = 0;
      }
    }
  }

  await supabase.from("competitors").update(patch).eq("id", competitor.id);
}

export async function fetchPageText(url: string): Promise<string> {
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
type TokenAtsProvider = "greenhouse" | "lever" | "ashby" | "workable" | "smartrecruiters" | "icims";
type AtsProvider = TokenAtsProvider | "workday";
type AtsDetection =
  | { provider: TokenAtsProvider; boardToken: string }
  // Workday has no single board token — a career site is identified by
  // three parts (tenant, data-center "pod" like wd1/wd3/wd5, and a site
  // name), none of which are guessable from a company name the way a
  // Greenhouse/Lever/Ashby token is (see probeAtsBySlug below, which
  // deliberately excludes Workday for this reason).
  | { provider: "workday"; tenant: string; pod: string; site: string };

const ATS_PATTERNS: { provider: TokenAtsProvider; regex: RegExp }[] = [
  { provider: "greenhouse", regex: /(?:boards|job-boards)\.greenhouse\.io\/([a-zA-Z0-9-]+)/ },
  { provider: "lever", regex: /jobs\.lever\.co\/([a-zA-Z0-9-]+)/ },
  { provider: "ashby", regex: /jobs\.ashbyhq\.com\/([a-zA-Z0-9-]+)/ },
  { provider: "workable", regex: /apply\.workable\.com\/([a-zA-Z0-9-]+)/ },
  { provider: "smartrecruiters", regex: /careers\.smartrecruiters\.com\/([a-zA-Z0-9-]+)/ },
  // Matches both the `<company>.icims.com` hosted form and a vanity domain
  // that embeds a link back to it (e.g. jobs.acme.com proxying icims.com
  // underneath still leaves an icims.com reference somewhere in the HTML).
  { provider: "icims", regex: /([a-zA-Z0-9-]+)\.icims\.com/ },
];

// Workday career-site URLs look like
// https://{tenant}.{pod}.myworkdayjobs.com/{locale}/{site}/... — the locale
// segment is optional and, when present, is a short language code
// (en-US, fr-FR) rather than the site name itself, so it has to be told
// apart from the real site segment instead of always taking "the first
// path segment."
const WORKDAY_PATTERN = /([a-zA-Z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_-]+))?/;
const LOCALE_SEGMENT_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;

function detectAts(careersUrl: string, html: string): AtsDetection | null {
  for (const haystack of [careersUrl, html]) {
    const workdayMatch = haystack.match(WORKDAY_PATTERN);
    if (workdayMatch) {
      const [, tenant, pod, firstSegment, secondSegment] = workdayMatch;
      const site = secondSegment && LOCALE_SEGMENT_PATTERN.test(firstSegment) ? secondSegment : firstSegment;
      return { provider: "workday", tenant, pod, site };
    }
    for (const { provider, regex } of ATS_PATTERNS) {
      const match = haystack.match(regex);
      if (match) return { provider, boardToken: match[1] };
    }
  }
  return null;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`ATS API fetch failed (${res.status}): ${url}`);
  return res.json();
}

// Workday's own career-site frontend calls this same endpoint to render
// its search page — undocumented, but a stable, consistent shape across
// every Workday tenant (unlike iCIMS below), confirmed by multiple
// independent write-ups of the same pattern. One page at a time; capped at
// WORKDAY_MAX_JOBS total so one very large employer can't turn a single
// crawl into dozens of paginated requests.
const WORKDAY_PAGE_SIZE = 20;
const WORKDAY_MAX_JOBS = 200;

async function fetchWorkdayJobs(tenant: string, pod: string, site: string): Promise<AtsJob[]> {
  const jobs: AtsJob[] = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total && offset < WORKDAY_MAX_JOBS) {
    const data = (await fetchJson(`https://${tenant}.${pod}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "Accept-Language": "en-US" },
      body: JSON.stringify({ appliedFacets: {}, limit: WORKDAY_PAGE_SIZE, offset, searchText: "" }),
    })) as { total?: number; jobPostings?: { title: string }[] };

    const batch = data.jobPostings ?? [];
    // Workday's basic listing response has no department/team field the
    // way Greenhouse or Ashby do — categorizeTitle in checkJobPostingsDiff
    // fills the gap the same way it already does for Workable/Ashby
    // postings that omit one.
    jobs.push(...batch.map((j) => ({ title: j.title, department: null })));
    total = typeof data.total === "number" ? data.total : jobs.length;
    if (batch.length === 0) break;
    offset += batch.length;
  }
  return jobs;
}

// iCIMS, unlike every other provider here, has no documented or verified
// public API — its real feed requires an OAuth partner agreement, and the
// endpoint career sites use internally to render their own search page is
// undocumented, changes shape across iCIMS product modules, and isn't
// confirmed to work the same way for any two tenants. This tries the two
// paths most commonly cited as that internal surface and duck-types
// whatever comes back (looks for an array of objects with a string title-
// like field) rather than assuming one fixed schema, since there's no
// verified contract to code against. Expected to work for some real
// tenants and not others; a failure or unrecognizable shape is treated as
// a miss like any other ATS error, falling back to the generic scrape.
const ICIMS_TITLE_FIELDS = ["title", "jobTitle", "postingTitle", "requisitionTitle"];

function extractIcimsJobs(payload: unknown): AtsJob[] | null {
  const candidateArray = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? (Object.values(payload as Record<string, unknown>).find((v) => Array.isArray(v)) as unknown[] | undefined)
      : undefined;
  if (!Array.isArray(candidateArray) || candidateArray.length === 0) return null;

  const jobs: AtsJob[] = [];
  for (const entry of candidateArray) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const titleField = ICIMS_TITLE_FIELDS.find((f) => typeof record[f] === "string");
    if (!titleField) continue;
    const department = typeof record.department === "string" ? record.department : null;
    jobs.push({ title: record[titleField] as string, department });
  }
  return jobs.length > 0 ? jobs : null;
}

async function fetchIcimsJobs(subdomain: string): Promise<AtsJob[]> {
  const candidatePaths = [
    `https://${subdomain}.icims.com/jobs/intelliservices`,
    `https://${subdomain}.icims.com/api/jobs`,
  ];
  for (const url of candidatePaths) {
    try {
      const payload = await fetchJson(url, { headers: { Accept: "application/json" } });
      const jobs = extractIcimsJobs(payload);
      if (jobs) return jobs;
    } catch {
      // Wrong path, non-JSON response, or this tenant's iCIMS module
      // doesn't expose it this way — try the next candidate rather than
      // failing the whole probe on the first miss.
    }
  }
  return [];
}

// One fetcher per provider, each mapped to the same {title, department}
// shape — the API responses genuinely differ (Lever nests categories,
// Greenhouse gives an array of department objects, etc.), so this is where
// that gets normalized away. Any parse failure (a schema change on their
// end, an empty/private board) falls back to the generic scrape rather
// than taking the whole crawl down — see the try/catch in checkJobPostingsDiff.
async function fetchAtsJobs(detection: AtsDetection): Promise<AtsJob[]> {
  if (detection.provider === "workday") {
    return fetchWorkdayJobs(detection.tenant, detection.pod, detection.site);
  }
  const { provider, boardToken } = detection;
  switch (provider) {
    case "icims":
      return fetchIcimsJobs(boardToken);
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

// Last-resort fallback for a competitor whose own careers page 403s us
// (bot protection — the same class of block confirmed on several real
// domains) before we ever get HTML to scan for an embedded ATS reference.
// detectAts above only finds a board it's *told about*, via the careers URL
// itself or a link/iframe in that page's markup — neither works when we
// can't fetch the page at all. Greenhouse/Lever/Ashby board tokens are
// overwhelmingly just the company's own name, so this guesses a couple of
// slug candidates from the domain/name and probes each provider directly.
// A guess only counts as a hit if the API actually returns real postings —
// an empty or 404 board is treated as a miss, not "this company has zero
// open roles," so a wrong guess can't silently masquerade as a real reading.
function slugCandidates(domain: string | null, name: string): string[] {
  const candidates = new Set<string>();
  if (domain) {
    const bare = domain.replace(/^www\./, "").split(".")[0];
    if (bare) candidates.add(bare.toLowerCase());
  }
  const fromName = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (fromName) candidates.add(fromName);
  const hyphenatedFromName = name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
  if (hyphenatedFromName) candidates.add(hyphenatedFromName);
  return Array.from(candidates);
}

// Only the two most common startup ATSs plus Ashby — Workable/SmartRecruiters
// board tokens are far less predictable from a company name, so guessing at
// those specifically would mostly just add failed requests.
const GUESSABLE_PROVIDERS: TokenAtsProvider[] = ["greenhouse", "lever", "ashby"];

async function probeAtsBySlug(domain: string | null, name: string): Promise<{ detection: AtsDetection; jobs: AtsJob[] } | null> {
  for (const boardToken of slugCandidates(domain, name)) {
    for (const provider of GUESSABLE_PROVIDERS) {
      try {
        const jobs = await fetchAtsJobs({ provider, boardToken });
        if (jobs.length > 0) return { detection: { provider, boardToken }, jobs };
      } catch {
        // Wrong guess (404/empty board) — try the next provider/slug rather
        // than treating this as a real failure worth logging.
      }
    }
  }
  return null;
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

type SnapshotKind = "pricing" | "jobs" | "producthunt" | "websearch" | "homepage" | "changelog" | "blog";

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
  text: string,
  // Only changelog/blog set this (the homepage link they were found at) —
  // stored so the next check goes straight there instead of re-scanning
  // the homepage every week.
  sourceUrl?: string | null
) {
  await supabase.from("page_snapshots").upsert(
    {
      competitor_id: competitorId,
      kind,
      content_hash: hashText(text),
      raw_text: text.slice(0, 20_000),
      captured_at: new Date().toISOString(),
      ...(sourceUrl !== undefined ? { source_url: sourceUrl } : {}),
    },
    { onConflict: "competitor_id,kind" }
  );
}

// Wayback Machine's "available" API — free, no key required. Two uses below,
// both parameterized off this one lookup:
//  1. Cold start (fetchWaybackSnapshotText, ~180 days back): a genuinely new
//     competitor gets one real "here's how this changed" signal on its very
//     first check, by comparing today's page against an archive snapshot
//     from ~6 months ago, instead of pricing history staying blank until our
//     second crawl produces a diff.
//  2. Bot-blocked pricing pages (fetchLatestWaybackSnapshotText, "now"): a
//     competitor whose pricing page always 403s to us directly (confirmed on
//     several real domains — same block with a real browser User-Agent) used
//     to just permanently no-op on pricing. Falling back to the most recent
//     archived snapshot means Gusto-style bot-blocked competitors still get
//     periodic pricing reads instead of "not yet checked" forever. Not
//     real-time, but Wayback recrawls popular SaaS pricing pages often
//     enough to catch a tier/price change within weeks rather than never —
//     and a new signup sees this history on day one instead of a blank page
//     while we wait for our own crawls to accumulate (see PricingSource
//     below).
const WAYBACK_LOOKBACK_DAYS = 180;

async function fetchWaybackSnapshotAt(
  url: string,
  timestamp: string,
  maxAgeDays?: number
): Promise<{ text: string; capturedAt: string } | null> {
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

  if (maxAgeDays !== undefined) {
    // snapshot.timestamp is YYYYMMDDhhmmss.
    const capturedAt = new Date(
      `${snapshot.timestamp.slice(0, 4)}-${snapshot.timestamp.slice(4, 6)}-${snapshot.timestamp.slice(6, 8)}T00:00:00Z`
    );
    const ageDays = (Date.now() - capturedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > maxAgeDays) return null;
  }

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

function fetchWaybackSnapshotText(url: string): Promise<{ text: string; capturedAt: string } | null> {
  const target = new Date();
  target.setUTCDate(target.getUTCDate() - WAYBACK_LOOKBACK_DAYS);
  return fetchWaybackSnapshotAt(url, target.toISOString().slice(0, 10).replace(/-/g, ""));
}

// Confirmed against a real domain (Gusto): a page that's redirected for
// years can leave Wayback's "closest" match years stale even when asked for
// "now" — the API only matches snapshots that captured a 200 on the exact
// URL, and if the last one of those was in 2016, that's what comes back.
// Presenting a decade-old price as "current" would be worse than showing
// nothing, so anything older than this is treated as no snapshot at all.
const MAX_USABLE_WAYBACK_AGE_DAYS = 400;

function fetchLatestWaybackSnapshotText(url: string): Promise<{ text: string; capturedAt: string } | null> {
  // Today's date as the target timestamp: the "available" API returns the
  // closest snapshot to it, which — since nothing is archived in the future
  // — is simply the most recent capture Wayback has.
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return fetchWaybackSnapshotAt(url, today, MAX_USABLE_WAYBACK_AGE_DAYS);
}

export type PricingPageResult = {
  text: string;
  // "live" when we fetched the page ourselves this run; "wayback" when the
  // direct fetch failed (bot block, timeout, etc.) and this is the most
  // recent Wayback Machine snapshot instead — callers should caveat any
  // output derived from this as possibly stale, not present it as a fresh
  // read.
  source: "live" | "wayback";
  capturedAt?: string;
};

// Fetches a competitor's pricing page ONCE per crawl run — checkPricingDiff
// and checkPricingStructure both need the current page text, and
// previously each called fetchPageText independently, doubling outbound
// requests (and 403/bot-block risk) per competitor per crawl for no
// reason. Callers share one in-flight promise (see runCrawlForAccount) so
// this only runs once; null means "couldn't load anything at all, live or
// archived," not "no pricing URL" (that's checked separately by each
// caller).
export async function fetchCompetitorPricingText(competitor: Competitor): Promise<PricingPageResult | null> {
  if (!competitor.pricing_url) return null;
  try {
    const text = await fetchPageText(competitor.pricing_url);
    return { text, source: "live" };
  } catch (err) {
    console.error(`pricing page unreachable for ${competitor.name} (${competitor.pricing_url}), trying Wayback:`, err);
    const archived = await fetchLatestWaybackSnapshotText(competitor.pricing_url);
    if (!archived) return null;
    return { text: archived.text, source: "wayback", capturedAt: archived.capturedAt };
  }
}

// Pricing/site diff — compares today's page text against the last crawl,
// then asks Claude what specifically changed so the signal is a concrete
// claim ("entry tier dropped to $69/mo") rather than "something changed."
// Trivial changes (timestamps, copy tweaks) are filtered out entirely.
export async function checkPricingDiff(
  supabase: AdminClient,
  competitor: Competitor,
  page: PricingPageResult | null
): Promise<Signal | null> {
  if (!competitor.pricing_url) return null;
  // "Live" specifically, not "we got a page at all" — a Wayback fallback
  // means the stored URL is still failing on the live web even though
  // fetchCompetitorPricingText found a way to produce something to diff,
  // so it still counts as a miss for re-discovery purposes.
  await trackUrlHealth(supabase, competitor, "pricing", page !== null && page.source === "live");
  if (page === null) return null;

  const newText = page.text;
  const existing = await readSnapshot(supabase, competitor.id, "pricing");
  const newHash = hashText(newText);
  await writeSnapshot(supabase, competitor.id, "pricing", newText);

  // A new signup shouldn't have to wait for pricing history to accumulate —
  // give it one backfilled "here's how this changed" signal on the very
  // first check, whether or not the live page is even reachable. Runs once
  // ever per competitor (gated on !existing, which flips true the moment
  // writeSnapshot above has run once), not on every crawl.
  if (!existing) {
    const past = await fetchWaybackSnapshotText(competitor.pricing_url);
    if (!past) return null;
    // If today's read is itself a Wayback snapshot, don't diff it against
    // itself — happens when the live site's block predates any archive
    // capture recent enough to differ from the ~180-day-back lookup.
    if (page.source === "wayback" && past.capturedAt === page.capturedAt) return null;

    const diff = await summarizePricingChange(past.text, newText, competitor.account_id);
    if (!diff.meaningful || !diff.summary) return null;

    const capturedDate = `${past.capturedAt.slice(0, 4)}-${past.capturedAt.slice(4, 6)}-${past.capturedAt.slice(6, 8)}`;
    const { data } = await supabase
      .from("signals")
      .insert({
        competitor_id: competitor.id,
        type: "pricing",
        title: diff.summary,
        summary:
          page.source === "wayback"
            ? `Detected across two Wayback Machine snapshots (${capturedDate} vs ${page.capturedAt?.slice(0, 4)}-${page.capturedAt?.slice(4, 6)}-${page.capturedAt?.slice(6, 8)}) — ${competitor.name}'s pricing page blocks automated requests, so we can't confirm this is fully current.`
            : `Detected on ${competitor.name}'s pricing page, compared against a Wayback Machine snapshot from ${capturedDate}.`,
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
      summary:
        page.source === "wayback"
          ? `Detected on ${competitor.name}'s pricing page (via an archived snapshot — this page blocks automated requests, so we can't confirm it's current).`
          : `Detected on ${competitor.name}'s pricing page.`,
      scored: false,
      source: "pipeline",
    })
    .select("*")
    .single();

  return data;
}

// Appends one row to the append-only history table momentum's hiring/
// pricing components read (see computeMomentum in momentum.ts) — a
// competitor_pricing/competitor_hiring upsert alone only ever answers
// "what's true right now," so without this there'd be no way to measure
// how much open_role_count or lowest_price actually moved between two
// windows, only how many discrete signal events fired. Best-effort: a
// failure here shouldn't take down the pricing/hiring upsert it runs
// alongside.
async function recordStateHistory(
  supabase: AdminClient,
  competitorId: string,
  metric: "open_role_count" | "lowest_price" | "github_commit_velocity" | "review_rating" | "ad_count" | "buzz_mentions",
  value: number
): Promise<void> {
  const { error } = await supabase.from("competitor_state_history").insert({
    competitor_id: competitorId,
    metric,
    value,
  });
  if (error) console.error(`state history write failed (${metric}) for competitor ${competitorId}:`, error);
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
  page: PricingPageResult | null
): Promise<void> {
  if (!competitor.pricing_url) return;

  if (page === null) {
    // Previously a silent no-op — a page that consistently 403s (bot
    // protection on the pricing page, confirmed on several real competitor
    // domains: same block with a real browser User-Agent, so not a UA-string
    // fix) left the competitor stuck showing "Not yet checked" forever, with
    // nothing in the logs to explain why. fetchCompetitorPricingText already
    // tries a Wayback fallback and logs the fetch failure; this only fires
    // when even that came up empty (never archived, or archive itself
    // unreachable) — an honest record is written here so the UI can say
    // "couldn't check automatically" instead of implying a check just
    // hasn't happened yet.
    await supabase.from("competitor_pricing").upsert(
      {
        competitor_id: competitor.id,
        billing_model: "unknown",
        publicly_priced: false,
        note: "Couldn't load this pricing page automatically (it blocks automated requests) and no archived version was available: check it directly.",
        tiers: [],
        last_checked_at: new Date().toISOString(),
      },
      { onConflict: "competitor_id" }
    );
    return;
  }

  let extraction;
  try {
    extraction = await extractPricingStructure(page.text, competitor.account_id);
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

  // Archived data is the best we have for a bot-blocked page, but it isn't
  // live — say so, rather than presenting a months-old snapshot with the
  // same confidence as a page we just fetched ourselves.
  const note =
    page.source === "wayback"
      ? `${extraction.note ? `${extraction.note} ` : ""}Based on an archived snapshot from ${page.capturedAt?.slice(0, 4)}-${page.capturedAt?.slice(4, 6)}-${page.capturedAt?.slice(6, 8)} — this page blocks automated requests, so we can't confirm it's still current.`
      : extraction.note;

  await supabase.from("competitor_pricing").upsert(
    {
      competitor_id: competitor.id,
      billing_model: extraction.billingModel,
      publicly_priced: extraction.publiclyPriced,
      note,
      tiers: extraction.tiers,
      last_checked_at: new Date().toISOString(),
    },
    { onConflict: "competitor_id" }
  );

  // The entry-tier price is the one number most likely to actually move and
  // to matter competitively (a cut/hike on the cheapest paid plan), so it's
  // what momentum's pricing component tracks — not an average across tiers,
  // which would blur a real change with unrelated enterprise-tier noise.
  // Skipped entirely when nothing here has a public price (custom/"contact
  // us" pricing): there's no meaningful number to record, and writing 0
  // would read as a real price to anything comparing values later.
  const pricedTiers = extraction.tiers.filter((t): t is typeof t & { price: number } => t.price !== null);
  if (pricedTiers.length > 0) {
    const lowestPrice = Math.min(...pricedTiers.map((t) => t.price));
    await recordStateHistory(supabase, competitor.id, "lowest_price", lowestPrice);
  }
}

// Job postings — extracts individual listing titles and diffs the set,
// rather than hashing the whole page, so the signal names the actual new
// role(s) instead of just flagging that the page changed.
export async function checkJobPostingsDiff(
  supabase: AdminClient,
  competitor: Competitor
): Promise<Signal | null> {
  if (!competitor.careers_url) return null;

  let html = "";
  let fetchedLive = false;
  try {
    html = await fetchHtml(competitor.careers_url);
    fetchedLive = true;
  } catch (err) {
    // Previously this threw straight out of the function — Promise.allSettled
    // in crawl.ts swallowed the rejection with no log at all, so a
    // bot-blocked careers page (same class of block confirmed on pricing
    // pages) left hiring stuck at "not yet checked" with nothing to explain
    // why. Logged now, and detectAts/the slug-guess fallback below both still
    // get a chance to find a real ATS board even with no HTML in hand.
    console.error(`careers page unreachable for ${competitor.name} (${competitor.careers_url}):`, err);
  }
  // Tracked on the raw page fetch specifically, not on whether a signal
  // ultimately came out of this crawl — an ATS guess panning out shouldn't
  // mask that the stored careers_url itself is dead and worth re-discovering.
  await trackUrlHealth(supabase, competitor, "careers", fetchedLive);
  const detection = detectAts(competitor.careers_url, html);

  // ATS jobs win when detection succeeds and the API actually returns
  // something — a private/empty board or a schema change on their end
  // falls back to the generic scrape rather than reporting zero roles as
  // if that were a real reading.
  let atsJobs: AtsJob[] = [];
  let atsProvider: AtsProvider | null = null;
  if (detection) {
    try {
      atsJobs = await fetchAtsJobs(detection);
      atsProvider = detection.provider;
    } catch (err) {
      console.error(`ATS API fetch failed for ${competitor.name} (${detection.provider}):`, err);
    }
  }

  // Nothing found the normal way (no board referenced in the URL or page,
  // or the page itself was unreachable) — guess a board token from the
  // company's own name/domain and probe Greenhouse/Lever/Ashby directly.
  if (atsJobs.length === 0) {
    const guessed = await probeAtsBySlug(competitor.domain, competitor.name);
    if (guessed) {
      atsJobs = guessed.jobs;
      atsProvider = guessed.detection.provider;
    }
  }

  const usingAts = atsJobs.length > 0;
  if (!usingAts && !html) {
    // Couldn't read the page directly and no ATS guess panned out either —
    // nothing to scrape, and no honest reading to fall back to. Leave the
    // existing competitor_hiring row alone rather than overwriting good data
    // with a false zero.
    return null;
  }

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
      source: atsProvider,
      last_checked_at: new Date().toISOString(),
    },
    { onConflict: "competitor_id" }
  );
  await recordStateHistory(supabase, competitor.id, "open_role_count", titles.length);

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

// Scans a competitor's homepage links for a changelog/blog-shaped href, the
// same heuristic discoverCompetitorUrls uses for pricing/careers. Returns
// null (not a fallback guess) when nothing matches — most competitors don't
// have either page, so guessing a URL here would mostly generate 404s.
async function findHomepageLink(homepageUrl: string, pattern: RegExp): Promise<string | null> {
  let html: string;
  let baseUrl: string;
  try {
    const res = await fetch(homepageUrl, {
      headers: { "User-Agent": "RipplewatchBot/1.0 (+https://ripplewatch.ai)" },
      signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    html = await res.text();
    baseUrl = res.url;
  } catch {
    return null;
  }

  const $ = cheerio.load(html);
  let found: string | null = null;
  $("a[href]").each((_, el) => {
    if (found) return false;
    const href = $(el).attr("href");
    if (!href) return;
    const haystack = `${$(el).text()} ${href}`.toLowerCase();
    if (pattern.test(haystack)) {
      try {
        found = new URL(href, baseUrl).toString();
      } catch {
        // malformed href — skip
      }
    }
  });
  return found;
}

// Shared by checkChangelogDiff/checkBlogDiff: same hash-then-LLM-diff shape
// as checkProductMessagingDiff above, plus a URL-resolution step first —
// the source_url found (or not) on a prior run is cached on the snapshot
// row so most weeks skip straight to fetching it instead of re-scanning the
// homepage. A competitor with no matching page just keeps writing an empty
// snapshot on the same weekly cadence (self-heals if one shows up later),
// rather than being scanned every single crawl forever.
async function checkContentPageDiff(
  supabase: AdminClient,
  competitor: Competitor,
  kind: "changelog" | "blog",
  pattern: RegExp,
  label: string
): Promise<Signal | null> {
  const clean = normalizeDomain(competitor.domain ?? "");
  if (!clean) return null;
  const homepageUrl = `https://${clean}`;

  const existing = await readSnapshot(supabase, competitor.id, kind);
  if (existing) {
    const daysSinceCheck = (Date.now() - new Date(existing.captured_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCheck < HOMEPAGE_CHECK_INTERVAL_DAYS) return null;
  }

  const pageUrl = existing?.source_url ?? (await findHomepageLink(homepageUrl, pattern));
  if (!pageUrl) {
    // Nothing found (or found before and this run just re-confirms it's
    // still not there) — write an empty snapshot so the weekly gate above
    // applies next time, without claiming a page exists.
    await writeSnapshot(supabase, competitor.id, kind, "", null);
    return null;
  }

  let newText: string;
  try {
    newText = await fetchPageText(pageUrl);
  } catch (err) {
    console.error(`${label} unreachable for ${competitor.name} (${pageUrl}):`, err);
    // The cached link may be stale (page moved/removed) — drop it so next
    // week re-discovers from the homepage instead of retrying a dead URL
    // forever, same self-healing shape as ensureMonitoringUrls.
    await writeSnapshot(supabase, competitor.id, kind, "", null);
    return null;
  }

  const newHash = hashText(newText);
  await writeSnapshot(supabase, competitor.id, kind, newText, pageUrl);

  if (!existing || !existing.source_url) return null;
  if (existing.content_hash === newHash) return null;

  const diff = await summarizeProductChange(existing.raw_text ?? "", newText, competitor.account_id);
  if (!diff.meaningful || !diff.summary) return null;

  const { data } = await supabase
    .from("signals")
    .insert({
      competitor_id: competitor.id,
      type: "product_change",
      title: diff.summary,
      summary: `Detected on ${competitor.name}'s ${label}.`,
      url: pageUrl,
      scored: false,
      source: "pipeline",
    })
    .select("*")
    .single();

  return data;
}

export async function checkChangelogDiff(supabase: AdminClient, competitor: Competitor): Promise<Signal | null> {
  return checkContentPageDiff(supabase, competitor, "changelog", CHANGELOG_LINK_PATTERN, "changelog");
}

export async function checkBlogDiff(supabase: AdminClient, competitor: Competitor): Promise<Signal | null> {
  return checkContentPageDiff(supabase, competitor, "blog", BLOG_LINK_PATTERN, "blog");
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
        // Always positive by definition — a product launch is inherently
        // favorable framing, no LLM classification needed for this one.
        sentiment: "positive",
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
): Promise<(T & { classifiedType: "news" | "funding"; classifiedSentiment: SignalSentiment })[]> {
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
    .map((h, i) => ({ ...h, classifiedType: classified[i].type, classifiedSentiment: classified[i].sentiment }))
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
        sentiment: headline.classifiedSentiment,
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
        sentiment: headline.classifiedSentiment,
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

// Opt-in — only runs when the competitor has a github_repo set (see
// migration 0056). No signal fires here, same as the pricing/hiring
// current-state snapshots above: just a periodic state-history reading
// for computeMomentum's magnitude comparison, since GitHub is the only
// source of truth for its own commit history and Ripplewatch needs to
// snapshot it over time the same way it does open_role_count/lowest_price.
export async function checkGithubActivity(supabase: AdminClient, competitor: Competitor): Promise<void> {
  if (!competitor.github_repo) return;

  const velocity = await fetchGithubCommitVelocity(competitor.github_repo);
  if (velocity === null) return;

  await recordStateHistory(supabase, competitor.id, "github_commit_velocity", velocity);
}

// --- Review site sentiment (G2/Capterra) ---------------------------------

// One-time discovery, same pattern as ensureMonitoringUrls for pricing/
// careers — G2/Capterra URLs aren't guessable from a domain, so this uses
// a real web search (discoverReviewUrls) exactly once per competitor and
// caches whatever it finds (including "found nothing," implicitly, by
// simply not re-running once both fields have been attempted — see the
// `attempted` guard below, since null/null is a legitimate outcome for a
// competitor with no G2 or Capterra presence, not a failure to retry).
const REVIEW_CHECK_INTERVAL_DAYS = 7;

async function ensureReviewUrls(supabase: AdminClient, competitor: Competitor): Promise<Competitor> {
  if (competitor.g2_url !== null || competitor.capterra_url !== null) return competitor;

  const existing = await supabase
    .from("competitor_reviews")
    .select("competitor_id")
    .eq("competitor_id", competitor.id)
    .maybeSingle();
  // A competitor_reviews row already existing means discovery already ran
  // once (see checkReviewSentiment below, which always upserts one) and
  // came up empty — don't repeat the web-search call every crawl.
  if (existing.data) return competitor;

  const { g2Url, capterraUrl } = await discoverReviewUrls(competitor.name, competitor.domain, competitor.account_id);
  if (!g2Url && !capterraUrl) return competitor;

  const { data: updated } = await supabase
    .from("competitors")
    .update({ g2_url: g2Url, capterra_url: capterraUrl })
    .eq("id", competitor.id)
    .select("*")
    .single();

  return updated ?? competitor;
}

// Structured current-state read (rating + review count per source), weekly-
// gated like the homepage check — ratings move slowly, so a daily Claude
// call here would mostly burn cost re-reading the same number. The rating
// itself doubles as computeMomentum's "review_rating" magnitude metric
// (weighted toward whichever source has more reviews when both exist,
// since a 4.8 from 12 reviews and a 4.2 from 4,000 shouldn't count equally).
export async function checkReviewSentiment(supabase: AdminClient, competitor: Competitor): Promise<void> {
  const withUrls = await ensureReviewUrls(supabase, competitor);
  if (!withUrls.g2_url && !withUrls.capterra_url) return;

  const { data: existing } = await supabase
    .from("competitor_reviews")
    .select("last_checked_at")
    .eq("competitor_id", withUrls.id)
    .maybeSingle();
  if (existing) {
    const daysSinceCheck = (Date.now() - new Date(existing.last_checked_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCheck < REVIEW_CHECK_INTERVAL_DAYS) return;
  }

  const [g2Text, capterraText] = await Promise.all([
    withUrls.g2_url ? fetchPageText(withUrls.g2_url).catch(() => null) : Promise.resolve(null),
    withUrls.capterra_url ? fetchPageText(withUrls.capterra_url).catch(() => null) : Promise.resolve(null),
  ]);

  const [g2Stats, capterraStats] = await Promise.all([
    g2Text ? extractReviewStats(g2Text, withUrls.account_id) : Promise.resolve({ rating: null, reviewCount: null }),
    capterraText
      ? extractReviewStats(capterraText, withUrls.account_id)
      : Promise.resolve({ rating: null, reviewCount: null }),
  ]);

  // Both sources unreachable/unparseable this run (bot-blocked, page
  // structure changed) — leave the existing row alone rather than
  // overwriting good data with nulls, same stance as checkPricingStructure's
  // Claude-failure branch.
  if (g2Stats.rating === null && capterraStats.rating === null) return;

  await supabase.from("competitor_reviews").upsert(
    {
      competitor_id: withUrls.id,
      g2_rating: g2Stats.rating,
      g2_review_count: g2Stats.reviewCount,
      capterra_rating: capterraStats.rating,
      capterra_review_count: capterraStats.reviewCount,
      last_checked_at: new Date().toISOString(),
    },
    { onConflict: "competitor_id" }
  );

  // Review-count-weighted blend when both sources have a rating — a G2
  // rating backed by thousands of reviews should dominate a Capterra
  // rating backed by a handful, not average with it 50/50.
  const weightedRatings: { rating: number; weight: number }[] = [];
  if (g2Stats.rating !== null) weightedRatings.push({ rating: g2Stats.rating, weight: g2Stats.reviewCount ?? 1 });
  if (capterraStats.rating !== null)
    weightedRatings.push({ rating: capterraStats.rating, weight: capterraStats.reviewCount ?? 1 });
  const totalWeight = weightedRatings.reduce((sum, r) => sum + r.weight, 0);
  const blendedRating = weightedRatings.reduce((sum, r) => sum + r.rating * r.weight, 0) / totalWeight;

  await recordStateHistory(supabase, withUrls.id, "review_rating", Math.round(blendedRating * 100) / 100);
}

// --- Buzz (Reddit + Hacker News mention volume) ---------------------------

const BUZZ_CHECK_INTERVAL_DAYS = 7;

// No signal fires here (same stance as GitHub activity) — this is a
// magnitude-only momentum input. Mention volume feeds the "buzz_mentions"
// state-history metric; the tone read (summarizeBuzzSentiment) is stored
// as a short blurb on competitor_buzz for display, not part of the score
// itself, since a handful of titles isn't enough to trust a numeric
// sentiment delta the way press/funding's decay-weighted signal sentiment
// is (that's built from dozens of scored, dated signals over time).
export async function checkBuzzMentions(supabase: AdminClient, competitor: Competitor): Promise<void> {
  const { data: existing } = await supabase
    .from("competitor_buzz")
    .select("last_checked_at")
    .eq("competitor_id", competitor.id)
    .maybeSingle();
  if (existing) {
    const daysSinceCheck = (Date.now() - new Date(existing.last_checked_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCheck < BUZZ_CHECK_INTERVAL_DAYS) return;
  }

  const mentions = await fetchBuzzMentions(competitor.name);
  const sentimentSummary = await summarizeBuzzSentiment(
    competitor.name,
    mentions.map((m) => m.title),
    competitor.account_id
  );

  await supabase.from("competitor_buzz").upsert(
    {
      competitor_id: competitor.id,
      mention_count_30d: mentions.length,
      sentiment_summary: sentimentSummary,
      last_checked_at: new Date().toISOString(),
    },
    { onConflict: "competitor_id" }
  );

  await recordStateHistory(supabase, competitor.id, "buzz_mentions", mentions.length);
}

// --- Ad activity (Meta Ad Library) -----------------------------------------

const AD_CHECK_INTERVAL_DAYS = 7;

// Entirely skipped when META_AD_LIBRARY_ACCESS_TOKEN isn't configured (see
// fetchActiveAdCount) — no crawl error, just no reading, same pattern as
// ENABLE_WEB_SEARCH_NEWS. A small, deliberately optional part of momentum:
// most competitors won't have this populated until that token is set up,
// and computeReliability's per-component weighting already handles an
// always-absent component correctly (zero weight, same treatment as
// GitHub activity for a competitor with no repo set).
export async function checkAdActivity(supabase: AdminClient, competitor: Competitor): Promise<void> {
  const { data: existing } = await supabase
    .from("competitor_ads")
    .select("last_checked_at")
    .eq("competitor_id", competitor.id)
    .maybeSingle();
  if (existing) {
    const daysSinceCheck = (Date.now() - new Date(existing.last_checked_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCheck < AD_CHECK_INTERVAL_DAYS) return;
  }

  const result = await fetchActiveAdCount(competitor.name);
  if (result === null) return;

  await supabase.from("competitor_ads").upsert(
    {
      competitor_id: competitor.id,
      active_ad_count: result.count,
      last_checked_at: new Date().toISOString(),
    },
    { onConflict: "competitor_id" }
  );

  await recordStateHistory(supabase, competitor.id, "ad_count", result.count);
}

const VISUAL_CHECK_INTERVAL_DAYS = 7;
const SCREENSHOT_BUCKET = "competitor-screenshots";

// Entirely skipped when SCREENSHOTONE_ACCESS_KEY isn't configured (see
// captureScreenshot) — same dormant-until-configured pattern as
// checkAdActivity above. Gated to Plus/Advanced in crawl.ts
// (VISUAL_DIFF_ALLOWED) since unlike everything else here this is a paid
// API call per competitor per week, not free scraping.
//
// Only one screenshot is ever kept per competitor (competitor_screenshots
// is a rolling baseline, not a gallery): each run captures a new one,
// compares it against whatever was stored last week via Claude vision, then
// overwrites storage with the new one regardless of whether anything
// changed — so the next comparison is always "this week vs. last week," not
// "this week vs. whenever it last happened to change."
export async function checkVisualChange(supabase: AdminClient, competitor: Competitor): Promise<Signal | null> {
  const clean = normalizeDomain(competitor.domain ?? "");
  if (!clean) return null;
  const homepageUrl = `https://${clean}`;

  const { data: existing } = await supabase
    .from("competitor_screenshots")
    .select("storage_path, captured_at")
    .eq("competitor_id", competitor.id)
    .maybeSingle();
  if (existing) {
    const daysSinceCheck = (Date.now() - new Date(existing.captured_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCheck < VISUAL_CHECK_INTERVAL_DAYS) return null;
  }

  const newScreenshot = await captureScreenshot(homepageUrl);
  if (!newScreenshot) return null;

  let signal: Signal | null = null;

  if (existing) {
    const { data: previousBlob, error: downloadError } = await supabase.storage
      .from(SCREENSHOT_BUCKET)
      .download(existing.storage_path);

    if (!downloadError && previousBlob) {
      const previousBuffer = Buffer.from(await previousBlob.arrayBuffer());
      try {
        const diff = await compareScreenshots(previousBuffer, newScreenshot, competitor.account_id);
        if (diff.meaningful && diff.summary) {
          const { data } = await supabase
            .from("signals")
            .insert({
              competitor_id: competitor.id,
              type: "product_change",
              title: diff.summary,
              summary: `Detected via visual comparison of ${competitor.name}'s homepage.`,
              url: homepageUrl,
              scored: false,
              source: "pipeline",
            })
            .select("*")
            .single();
          signal = data;
        }
      } catch (err) {
        console.error(`compareScreenshots failed for ${competitor.name}:`, err);
      }
    }
  }

  const storagePath = `${competitor.id}.png`;
  await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .upload(storagePath, newScreenshot, { contentType: "image/png", upsert: true });
  await supabase.from("competitor_screenshots").upsert(
    { competitor_id: competitor.id, storage_path: storagePath, captured_at: new Date().toISOString() },
    { onConflict: "competitor_id" }
  );

  return signal;
}
