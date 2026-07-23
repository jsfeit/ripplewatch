import "server-only";
import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { summarizePricingChange, extractPricingStructure } from "@/lib/anthropic";

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
// "something new got posted," not a guarantee of zero false positives.
async function fetchJobListingTitles(url: string): Promise<string[]> {
  const html = await fetchHtml(url);
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

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

async function readSnapshot(supabase: AdminClient, competitorId: string, kind: "pricing" | "jobs") {
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
  kind: "pricing" | "jobs",
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

// Pricing/site diff — compares today's page text against the last crawl,
// then asks Claude what specifically changed so the signal is a concrete
// claim ("entry tier dropped to $69/mo") rather than "something changed."
// Trivial changes (timestamps, copy tweaks) are filtered out entirely.
export async function checkPricingDiff(
  supabase: AdminClient,
  competitor: Competitor
): Promise<Signal | null> {
  if (!competitor.pricing_url) return null;

  const newText = await fetchPageText(competitor.pricing_url);
  const existing = await readSnapshot(supabase, competitor.id, "pricing");
  const newHash = hashText(newText);
  await writeSnapshot(supabase, competitor.id, "pricing", newText);

  if (!existing || existing.content_hash === newHash) return null;

  const diff = await summarizePricingChange(existing.raw_text ?? "", newText);
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
export async function checkPricingStructure(supabase: AdminClient, competitor: Competitor): Promise<void> {
  if (!competitor.pricing_url) return;

  let pageText: string;
  try {
    pageText = await fetchPageText(competitor.pricing_url);
  } catch {
    return; // page unreachable this run — leave the last known snapshot in place
  }

  const extraction = await extractPricingStructure(pageText);

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

  const titles = await fetchJobListingTitles(competitor.careers_url);
  const joined = titles.join("\n");
  const existing = await readSnapshot(supabase, competitor.id, "jobs");
  const newHash = hashText(joined);
  await writeSnapshot(supabase, competitor.id, "jobs", joined);

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

// Google News RSS's <description> for search results is usually just the
// headline re-wrapped in a link (sometimes a short list of related
// headlines), not real article body text — so this is a best-effort bump
// over "just the source name," not a full-article summary. Genuinely
// richer content would mean following the redirect to the source site,
// which isn't worth the added fragility/latency in a cron loop for what's
// still just a headline-level signal.
async function fetchTopHeadline(
  query: string
): Promise<{ title: string; source: string | null; description: string | null; link: string | null } | null> {
  const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetch(feedUrl, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;

  const xml = await res.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  const firstItem = $("item").first();
  const title = firstItem.find("title").text().trim();
  if (!title) return null;

  const source = firstItem.find("source").text().trim() || null;
  const link = firstItem.find("link").text().trim() || null;
  const rawDescription = firstItem.find("description").text().trim();
  // Strip the HTML the field is wrapped in and drop it if it's just the
  // title again — only keep it when it actually adds information.
  const cleanDescription = cheerio.load(rawDescription).text().replace(/\s+/g, " ").trim();
  const description =
    cleanDescription && cleanDescription !== title && !cleanDescription.startsWith(title) ? cleanDescription : null;

  return { title, source, description, link };
}

async function existingSignalTitle(
  supabase: AdminClient,
  competitorId: string,
  title: string
): Promise<boolean> {
  // Checked across both news and funding so the same headline never ends up
  // filed under both types if it happens to match both searches.
  const { data } = await supabase
    .from("signals")
    .select("id")
    .eq("competitor_id", competitorId)
    .in("type", ["news", "funding"])
    .eq("title", title)
    .maybeSingle();
  return Boolean(data);
}

// News — free Google News RSS query, no API key required. De-duped against
// existing signal titles for this competitor rather than a snapshot hash,
// since RSS feeds don't have a stable "page" to diff.
export async function checkNews(supabase: AdminClient, competitor: Competitor): Promise<Signal | null> {
  const headline = await fetchTopHeadline(competitor.name);
  if (!headline) return null;
  if (await existingSignalTitle(supabase, competitor.id, headline.title)) return null;

  const { data } = await supabase
    .from("signals")
    .insert({
      competitor_id: competitor.id,
      type: "news",
      title: headline.title,
      summary: headline.description ?? headline.source,
      url: headline.link,
      scored: false,
      source: "pipeline",
    })
    .select("*")
    .single();

  return data;
}

// Funding — same free Google News RSS approach, but with a query weighted
// toward funding-announcement language so raises/rounds get classified and
// surfaced distinctly from general news instead of getting buried in it.
export async function checkFunding(supabase: AdminClient, competitor: Competitor): Promise<Signal | null> {
  const query = `"${competitor.name}" (raises OR "seed round" OR "series a" OR "series b" OR "series c" OR funding OR valuation)`;
  const headline = await fetchTopHeadline(query);
  if (!headline) return null;
  if (await existingSignalTitle(supabase, competitor.id, headline.title)) return null;

  const { data } = await supabase
    .from("signals")
    .insert({
      competitor_id: competitor.id,
      type: "funding",
      title: headline.title,
      summary: headline.description ?? headline.source,
      url: headline.link,
      scored: false,
      source: "pipeline",
    })
    .select("*")
    .single();

  return data;
}
