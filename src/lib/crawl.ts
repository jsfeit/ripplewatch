import "server-only";
import {
  fetchCompetitorPricingText,
  checkPricingDiff,
  checkPricingStructure,
  checkJobPostingsDiff,
  checkProductHuntLaunches,
  checkProductMessagingDiff,
  checkChangelogDiff,
  checkBlogDiff,
  checkVisualChange,
  checkNews,
  checkFunding,
  checkSearchNews,
  isFirstNewsCheck,
  ensureMonitoringUrls,
  checkGithubActivity,
  checkReviewSentiment,
  checkBuzzMentions,
  checkAdActivity,
} from "@/lib/scraping";
import {
  scoreSignal,
  extractCompetitorMentions,
  researchCompanyContext,
  SCORING_PROMPT_VERSION,
  type CompetitorMention,
} from "@/lib/anthropic";
import { sendSlackAlert } from "@/lib/slack";
import { ensureIndustryTrends } from "@/lib/industry-trends";
import { fetchRecentGongTranscripts } from "@/lib/gong";
import { fetchRecentZoomTranscripts } from "@/lib/zoom";
import { fetchClosedLostDealNotes } from "@/lib/hubspot";
import { fetchRecentIntercomChurnNotes } from "@/lib/intercom";
import {
  TIER_SIGNAL_SOURCES,
  CALL_INTEL_ALLOWED,
  CRM_ALLOWED,
  INTERCOM_ALLOWED,
  VISUAL_DIFF_ALLOWED,
  effectiveTier,
  competitorCap,
} from "@/lib/tier-limits";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Database, SignalType } from "@/lib/supabase/types";

type AdminSupabase = ReturnType<typeof createAdminClient>;
type Account = Database["public"]["Tables"]["accounts"]["Row"];
type Signal = Database["public"]["Tables"]["signals"]["Row"];

// Runs fn over items with at most `concurrency` in flight at once, instead
// of either a fully sequential loop (too slow once each item does several
// LLM calls) or an unbounded Promise.all (risks bursting past API rate
// limits). A plain sequential for-loop across competitors — each now doing
// several sequential LLM calls of its own after the news/funding dedup
// changes — is what pushed a 9-competitor recrawl past Vercel's 300s
// function timeout; this is the fix. Exported so the crawl cron
// (src/app/api/cron/crawl/route.ts) can apply the same bounded-concurrency
// pattern across accounts, not just within one — a fully sequential
// account loop meant one slow account (a rate-limited API, a hung fetch)
// could push accounts later in the list past the timeout without ever
// being crawled that day, with no error or partial-progress marker.
export async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

// Pulls recent Gong/Zoom call transcripts (if connected) and distills them
// down to competitor-mention sentences via Claude. Fetched once per account
// per crawl run, not per-signal — it's the same context for every signal
// scored in this run, and each provider call is expensive enough to want to
// avoid repeating it per competitor. Mentions stay tagged per-competitor so a
// signal about Competitor A never gets scored using a mention about
// Competitor B.
async function buildCallMentions(
  supabase: AdminSupabase,
  accountId: string,
  competitorNames: string[]
): Promise<CompetitorMention[]> {
  const { data: callIntegrations } = await supabase
    .from("integrations")
    .select("*")
    .eq("account_id", accountId)
    .in("provider", ["gong", "zoom"])
    .eq("connected", true);

  if (!callIntegrations || callIntegrations.length === 0) return [];

  const transcriptLists = await Promise.allSettled(
    callIntegrations.map((integration) => {
      const credentials = integration.credentials as { access_token: string } | null;
      if (!credentials?.access_token) return Promise.resolve([]);
      return integration.provider === "gong"
        ? fetchRecentGongTranscripts(credentials.access_token)
        : fetchRecentZoomTranscripts(credentials.access_token);
    })
  );

  const transcripts = transcriptLists.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (transcripts.length === 0) return [];

  return extractCompetitorMentions(transcripts, competitorNames, accountId);
}

// HubSpot's closed-lost deal reasons, refreshed each run — supplements
// (doesn't replace) whatever the account typed in manually during
// onboarding, so scoring reflects deals lost since then too.
async function buildHubspotNotes(supabase: AdminSupabase, accountId: string): Promise<string | null> {
  const { data: integration } = await supabase
    .from("integrations")
    .select("*")
    .eq("account_id", accountId)
    .eq("provider", "hubspot")
    .eq("connected", true)
    .maybeSingle();

  const credentials = integration?.credentials as { access_token: string } | null;
  if (!credentials?.access_token) return null;

  const notes = await fetchClosedLostDealNotes(credentials.access_token);
  return notes.length > 0 ? notes.join(" ") : null;
}

// Intercom's recent-conversation openers, refreshed each run — same role as
// buildHubspotNotes above but merged into churnNotes instead of
// lostDealNotes, since Intercom is the self-serve/PLG-side signal (customers
// churning) rather than the sales-led one (deals lost).
async function buildIntercomNotes(supabase: AdminSupabase, accountId: string): Promise<string | null> {
  const { data: integration } = await supabase
    .from("integrations")
    .select("*")
    .eq("account_id", accountId)
    .eq("provider", "intercom")
    .eq("connected", true)
    .maybeSingle();

  const credentials = integration?.credentials as { access_token: string } | null;
  if (!credentials?.access_token) return null;

  const notes = await fetchRecentIntercomChurnNotes(credentials.access_token);
  return notes.length > 0 ? notes.join(" ") : null;
}

// Self-heals accounts.company_research for accounts that predate this
// feature (onboarding computes it up front for new accounts — see
// /api/onboarding/complete) — computed once, cached, and reused on every
// subsequent crawl rather than re-researched every run. A stored non-null
// value (even the "nothing found" fallback string) is treated as "already
// computed" so this never repeats a paid web-search call for the same
// account twice.
async function ensureCompanyResearch(supabase: AdminSupabase, account: Account): Promise<string | null> {
  if (account.company_research) return account.company_research;

  try {
    const summary = await researchCompanyContext(account.name, account.positioning, account.id);
    await supabase
      .from("accounts")
      .update({ company_research: summary, company_research_updated_at: new Date().toISOString() })
      .eq("id", account.id);
    return summary;
  } catch (err) {
    console.error(`company research failed for ${account.name}:`, err);
    return null;
  }
}

export type CrawlSummary = { account: string; newSignals: number; scored: number; error?: string };
export type EnqueueSummary = { account: string; queued: number };

type Competitor = Database["public"]["Tables"]["competitors"]["Row"];

// Creates one crawl_jobs row per competitor this account actively monitors
// — nothing else. See migration 0065 for the full reasoning: the old
// shape ran every competitor for an account (or every account for the
// whole cron) inside a single request bounded by Vercel's 300s timeout, a
// ceiling that scales with total competitor/account count and no amount
// of concurrency tuning removes. Enqueueing is pure DB writes, so it stays
// fast regardless of how many competitors or accounts exist; the actual
// work happens later, one small job at a time, via processCrawlJobBatch
// (see /api/cron/crawl-worker).
export async function enqueueCrawlForAccount(supabase: AdminSupabase, account: Account): Promise<EnqueueSummary> {
  const { data: allCompetitors } = await supabase
    .from("competitors")
    .select("id")
    .eq("account_id", account.id)
    .order("created_at", { ascending: true });

  // Same cap logic as before: only the earliest-added competitors up to
  // the account's tier limit stay actively monitored (uncapped for
  // demo_mode — see tier-limits.ts).
  const competitors = (allCompetitors ?? []).slice(0, competitorCap(account.tier, account.demo_mode));

  if (competitors.length === 0) {
    return { account: account.name, queued: 0 };
  }

  const { data: run, error: runError } = await supabase
    .from("crawl_runs")
    .insert({ account_id: account.id, total_jobs: competitors.length })
    .select("id")
    .single();

  if (runError || !run) {
    console.error(`failed to create crawl run for ${account.name}:`, runError);
    return { account: account.name, queued: 0 };
  }

  const { error: jobsError } = await supabase
    .from("crawl_jobs")
    .insert(competitors.map((c) => ({ run_id: run.id, account_id: account.id, competitor_id: c.id })));

  if (jobsError) {
    console.error(`failed to enqueue crawl jobs for ${account.name}:`, jobsError);
    return { account: account.name, queued: 0 };
  }

  return { account: account.name, queued: competitors.length };
}

export type CompetitorCrawlOptions = {
  allowedSources: SignalType[];
  visualDiffAllowed: boolean;
  accountId: string;
};

// Everything one competitor's crawl actually does — every signal source
// check that used to run inline inside the old full-account loop, now the
// unit of work behind a single crawl_jobs row. Takes only what it needs
// (which sources/visual-diff this account's tier allows, plus the account
// id for checkSearchNews) rather than a whole Account, so a worker
// processing jobs from many different accounts in one batch doesn't need
// to refetch anything beyond that.
export async function crawlOneCompetitor(
  supabase: AdminSupabase,
  rawCompetitor: Competitor,
  { allowedSources, visualDiffAllowed, accountId }: CompetitorCrawlOptions
): Promise<Signal[]> {
  const found: Signal[] = [];

  // Backfills pricing_url/careers_url for a competitor that was added
  // without a domain (so the URL-guessing at add-time never ran) — a
  // no-op for the common case where both are already set. Without this,
  // checkPricingDiff/checkPricingStructure/checkJobPostingsDiff below all
  // just silently no-op forever, showing as permanently "Not yet checked."
  const competitor =
    allowedSources.includes("pricing") || allowedSources.includes("job_posting")
      ? await ensureMonitoringUrls(supabase, rawCompetitor)
      : rawCompetitor;

  // Computed once per competitor, before checkNews/checkFunding run
  // sequentially below — both need to agree on whether this is the
  // competitor's first-ever news/funding check (backfill vs. ongoing), and
  // letting each query it independently mid-flight is a race: whichever
  // inserts first makes the other see a nonzero count and wrongly
  // conclude it's no longer the first check.
  const isFirstCheck =
    allowedSources.includes("news") || allowedSources.includes("funding")
      ? await isFirstNewsCheck(supabase, competitor.id)
      : false;

  // checkNews and checkFunding run sequentially, not alongside the other
  // checks below — each one's same-story dedup (see
  // filterHeadlinesForCompetitor in scraping.ts) compares against this
  // competitor's recent signals, and running them in parallel would mean
  // checkFunding can't see what checkNews just inserted (and vice versa),
  // letting the same event slip through as two separate signals.
  //
  // Both call into Anthropic (headline relevance filtering, dedup) with no
  // guard of their own — previously an outage there (e.g. exhausted API
  // credits) threw uncaught straight out of this function, killing the
  // entire account's recrawl on whichever competitor happened to run
  // first instead of just skipping that one check for that one
  // competitor. Caught here the same way the checks[] array below already
  // is via Promise.allSettled.
  if (allowedSources.includes("news")) {
    try {
      found.push(...(await checkNews(supabase, competitor, isFirstCheck)));
    } catch (err) {
      console.error(`checkNews failed for ${competitor.name}:`, err);
    }
  }
  if (allowedSources.includes("funding")) {
    try {
      found.push(...(await checkFunding(supabase, competitor, isFirstCheck)));
    } catch (err) {
      console.error(`checkFunding failed for ${competitor.name}:`, err);
    }
  }

  // Fetched once and shared between checkPricingDiff and
  // checkPricingStructure below (both need the current page text) rather
  // than each independently fetching the same URL — a plain promise, not
  // an awaited value, so it still runs concurrently with the other checks
  // in the array below instead of blocking ahead of them.
  const pricingPageTextPromise = allowedSources.includes("pricing")
    ? fetchCompetitorPricingText(competitor)
    : Promise.resolve(null);

  // Pricing/jobs surface at most one signal per run (a diff against the
  // last snapshot) — normalized to arrays here so both shapes flatten into
  // `found` the same way as the sequential checks above.
  const checks = [
    allowedSources.includes("pricing")
      ? pricingPageTextPromise.then((text) => checkPricingDiff(supabase, competitor, text)).then((s) => (s ? [s] : []))
      : null,
    allowedSources.includes("job_posting")
      ? checkJobPostingsDiff(supabase, competitor).then((s) => (s ? [s] : []))
      : null,
    // Free API (stubbed pending a real token — see producthunt-data.ts);
    // own weekly gate lives inside checkProductHuntLaunches. Piggybacks on
    // the "news" tier gate rather than a new TIER_SIGNAL_SOURCES entry
    // since it inserts plain "news"-type signals.
    allowedSources.includes("news") ? checkProductHuntLaunches(supabase, competitor) : null,
    // Supplements the free RSS news check above with Claude web search —
    // off by default (real per-search cost, not modeled against tier
    // pricing yet). Enable per the web-search-news-decision checklist item.
    allowedSources.includes("news") && process.env.ENABLE_WEB_SEARCH_NEWS === "true"
      ? checkSearchNews(supabase, competitor, accountId)
      : null,
    // Free (just a homepage fetch + a hash-gated LLM call), so allowed on
    // every tier same as pricing/jobs above — no per-query third-party
    // cost the way SEO/traffic has.
    allowedSources.includes("product_change")
      ? checkProductMessagingDiff(supabase, competitor).then((s) => (s ? [s] : []))
      : null,
    // Same free scrape-and-hash shape as the homepage check above, just a
    // changelog/blog URL instead — no separate tier gate, piggybacks on
    // the same "product_change" source.
    allowedSources.includes("product_change")
      ? checkChangelogDiff(supabase, competitor).then((s) => (s ? [s] : []))
      : null,
    allowedSources.includes("product_change")
      ? checkBlogDiff(supabase, competitor).then((s) => (s ? [s] : []))
      : null,
    // Real visual diffing (screenshot + Claude vision comparison) is a
    // paid API call, unlike everything else in this array — gated to
    // Plus/Advanced (VISUAL_DIFF_ALLOWED) rather than uniform across
    // tiers. Also self-gates on SCREENSHOTONE_ACCESS_KEY being unset (see
    // checkVisualChange), so this is a no-op today until that's added.
    visualDiffAllowed ? checkVisualChange(supabase, competitor).then((s) => (s ? [s] : [])) : null,
    // Opt-in per competitor (github_repo set in Settings), not tier-gated
    // — free (GitHub's own public API), so no reason to restrict it the
    // way SEO's paid DataForSEO calls are. No signal fires; it's a
    // state-history snapshot only, so always resolves to [].
    competitor.github_repo ? checkGithubActivity(supabase, competitor).then(() => []) : null,
    // Same "no signal, state-history only" shape as GitHub above — not
    // tier-gated, each is either free (G2/Capterra scrape, HN/Reddit) or
    // self-gates on a missing credential (Meta Ad Library), so there's no
    // per-tier cost to restrict.
    checkReviewSentiment(supabase, competitor).then(() => []),
    checkBuzzMentions(supabase, competitor).then(() => []),
    checkAdActivity(supabase, competitor).then(() => []),
  ].filter((p): p is Promise<Signal[]> => p !== null);

  const results = await Promise.allSettled(checks);
  for (const result of results) {
    if (result.status === "fulfilled") found.push(...result.value);
  }

  // Refreshes the Pricing dashboard's current-state snapshot every run,
  // independent of whether a diff signal fired — runs before returning so
  // it's never skipped.
  if (allowedSources.includes("pricing")) {
    const pricingPageText = await pricingPageTextPromise;
    await checkPricingStructure(supabase, competitor, pricingPageText).catch((err) =>
      console.error(`pricing structure extraction failed for ${competitor.name}:`, err)
    );
  }

  return found;
}

const WORKER_BATCH_SIZE = 24;
// Each job is one competitor's checks now, not a whole account's — much
// lighter than the old per-account fan-out, so a higher bound than the
// previous COMPETITOR_CONCURRENCY (4) is safe.
const JOB_CONCURRENCY = 8;

export type WorkerBatchSummary = { processed: number; done: number; error: number };

// Claims and processes one bounded batch of pending crawl_jobs — called by
// /api/cron/crawl-worker on a short interval (every couple minutes) so
// however many jobs exist, there's just more ticks, never a single
// invocation whose duration scales with total competitor/account count. A
// slow or blocked competitor only fails its own job, not every other
// competitor queued behind it the way one slow one used to inside a
// shared per-account invocation.
export async function processCrawlJobBatch(supabase: AdminSupabase): Promise<WorkerBatchSummary> {
  const { data: jobs, error } = await supabase.rpc("claim_crawl_jobs", { batch_size: WORKER_BATCH_SIZE });
  if (error) {
    console.error("failed to claim crawl jobs:", error);
    return { processed: 0, done: 0, error: 0 };
  }
  if (!jobs || jobs.length === 0) return { processed: 0, done: 0, error: 0 };

  // Batched fetches instead of one query per job — several jobs in a batch
  // commonly belong to the same account (or, for a small account, are
  // literally every competitor it has).
  const accountIds = Array.from(new Set(jobs.map((j) => j.account_id)));
  const { data: accounts } = await supabase.from("accounts").select("*").in("id", accountIds);
  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));

  const competitorIds = jobs.map((j) => j.competitor_id);
  const { data: competitors } = await supabase.from("competitors").select("*").in("id", competitorIds);
  const competitorById = new Map((competitors ?? []).map((c) => [c.id, c]));

  let done = 0;
  let errorCount = 0;

  await mapWithConcurrency(jobs, JOB_CONCURRENCY, async (job) => {
    const account = accountById.get(job.account_id);
    const rawCompetitor = competitorById.get(job.competitor_id);

    if (!account || !rawCompetitor) {
      await supabase
        .from("crawl_jobs")
        .update({
          status: "error",
          error: "account or competitor no longer exists",
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      errorCount++;
      return;
    }

    const tier = effectiveTier(account.tier, account.demo_mode);
    try {
      await crawlOneCompetitor(supabase, rawCompetitor, {
        allowedSources: TIER_SIGNAL_SOURCES[tier],
        visualDiffAllowed: VISUAL_DIFF_ALLOWED[tier],
        accountId: account.id,
      });
      await supabase
        .from("crawl_jobs")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", job.id);
      done++;
    } catch (err) {
      console.error(`crawl job failed for competitor ${rawCompetitor.name}:`, err);
      await supabase
        .from("crawl_jobs")
        .update({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      errorCount++;
    }
  });

  return { processed: jobs.length, done, error: errorCount };
}

// Bounds how many signals one scoring pass will ever score, same reasoning
// as the old STALE_RESCUE_LIMIT: an unbounded pass risks the finalize
// function itself running long, and anything left over just gets picked up
// next time this account's signals are unscored. Set higher than the old
// rescue-only cap (20) since this is now the primary scoring path, not a
// rare backfill catcher — a normal day's signals should fully clear in one
// pass.
const SIGNALS_TO_SCORE_LIMIT = 60;
const SCORE_CONCURRENCY = 5;

// Scores every currently-unscored signal for one account's tracked
// competitors — the second half of what runCrawlForAccount used to do in
// one breath, now its own step so it runs once per finished crawl_run
// (see finalizeCompletedRuns) rather than once per worker tick. CRM/call-
// transcript pulls here (buildCallMentions/buildHubspotNotes/
// buildIntercomNotes) hit real third-party APIs, so this should run once a
// day per account, the same cadence the old full-account crawl had.
async function scoreAccountSignals(supabase: AdminSupabase, account: Account): Promise<CrawlSummary> {
  const tier = effectiveTier(account.tier, account.demo_mode);
  const { data: allCompetitors } = await supabase
    .from("competitors")
    .select("id, name")
    .eq("account_id", account.id)
    .order("created_at", { ascending: true });
  const competitors = (allCompetitors ?? []).slice(0, competitorCap(account.tier, account.demo_mode));
  const competitorIds = competitors.map((c) => c.id);

  if (competitorIds.length === 0) {
    return { account: account.name, newSignals: 0, scored: 0 };
  }

  const { data: unscored } = await supabase
    .from("signals")
    .select("*")
    .in("competitor_id", competitorIds)
    .eq("scored", false)
    .order("created_at", { ascending: true })
    .limit(SIGNALS_TO_SCORE_LIMIT);

  const signalsToScore: Signal[] = unscored ?? [];

  if (signalsToScore.length === 0) {
    return { account: account.name, newSignals: 0, scored: 0 };
  }

  const callMentions = CALL_INTEL_ALLOWED[tier]
    ? await buildCallMentions(
        supabase,
        account.id,
        competitors.map((c) => c.name)
      )
    : [];

  const hubspotNotes = CRM_ALLOWED[tier] ? await buildHubspotNotes(supabase, account.id) : null;
  const lostDealNotes = [account.lost_deal_notes, hubspotNotes].filter(Boolean).join(" ") || null;

  const intercomNotes = INTERCOM_ALLOWED[tier] ? await buildIntercomNotes(supabase, account.id) : null;
  const churnNotes = [account.churn_notes, intercomNotes].filter(Boolean).join(" ") || null;

  const companyResearch = await ensureCompanyResearch(supabase, account);

  // Fire-and-forget: nothing later in this function depends on the result,
  // and runIndustryTrendsForAccount already catches its own errors — this
  // just shouldn't add its (web-search-grounded, so slower) latency to
  // every crawl once the one-time self-heal is done. See ensureIndustryTrends
  // for why this adds no new recurring cost.
  ensureIndustryTrends(
    supabase,
    account,
    competitors.map((c) => c.name)
  );

  async function scoreOneSignal(signal: Signal): Promise<(Signal & { competitorName: string }) | null> {
    const competitor = competitors.find((c) => c.id === signal.competitor_id);
    if (!competitor) return null;

    // Only this competitor's call mentions — a mention about a different
    // competitor shouldn't influence this signal's score.
    const callInsights =
      callMentions
        .filter((m) => m.competitor.toLowerCase() === competitor.name.toLowerCase())
        .map((m) => m.mention)
        .join(" ") || null;

    try {
      const result = await scoreSignal(
        {
          companyName: account.name,
          positioning: account.positioning,
          icp: account.icp,
          lostDealNotes,
          churnNotes,
          callInsights,
          companyResearch,
        },
        { competitorName: competitor.name, type: signal.type, title: signal.title, summary: signal.summary },
        account.id
      );

      // The pre-insertion filter is supposed to catch a signal about an
      // unrelated company that just shares the competitor's name, but has
      // proven unreliable on real cases — scoring is a second, independent
      // check, and when it flags this the signal is removed outright rather
      // than kept around as low-relevance noise.
      if (result.wrongCompany) {
        await supabase.from("signals").delete().eq("id", signal.id);
        return null;
      }

      const { data: updated } = await supabase
        .from("signals")
        .update({
          scored: true,
          relevance_level: result.level,
          relevance_score: result.score,
          relevance_reasoning: result.reasoning,
          scoring_version: SCORING_PROMPT_VERSION,
        })
        .eq("id", signal.id)
        .select("*")
        .single();

      return updated ? { ...updated, competitorName: competitor.name } : null;
    } catch (err) {
      console.error(`scoring failed for signal ${signal.id}:`, err);
      return null;
    }
  }

  const scoredSignals: (Signal & { competitorName: string })[] = [];

  // Every tier scores every unscored signal — tiers differ by competitor
  // count and integrations now, not by scoring depth (2026-09
  // repositioning: Starter previously teaser-scored at most one
  // signal/week, which left its Momentum score starved of real
  // relevance-trend data; that throttle is gone).
  const results = await mapWithConcurrency(signalsToScore, SCORE_CONCURRENCY, scoreOneSignal);
  for (const result of results) {
    if (result) scoredSignals.push(result);
  }

  // Real-time push happens here, at scoring time — but only for High
  // relevance, and only to Slack. Medium/Low (and unscored raw signals) are
  // deliberately left alone: they're picked up by the daily and weekly
  // digest crons instead, keyed off relevance_level so a signal is never
  // pushed AND digested twice through the same channel. See
  // /api/cron/digest-daily and /api/cron/digest-weekly.
  // Backfill signals (a competitor's first-ever news/funding check, seeding
  // landscape context for a brand-new account — see scraping.ts) are
  // deliberately excluded from the real-time Slack push: Slack is for "this
  // just happened," and a backfilled article from months ago hasn't.
  const highRelevanceSignals = scoredSignals.filter((s) => s.relevance_level === "High" && s.source !== "backfill");
  if (highRelevanceSignals.length > 0) {
    const { data: slackIntegration } = await supabase
      .from("integrations")
      .select("*")
      .eq("account_id", account.id)
      .eq("provider", "slack")
      .eq("connected", true)
      .maybeSingle();

    if (slackIntegration?.credentials) {
      for (const signal of highRelevanceSignals) {
        await sendSlackAlert(slackIntegration.credentials as Parameters<typeof sendSlackAlert>[0], {
          competitorName: signal.competitorName,
          title: signal.title,
          url: signal.url,
          reasoning: signal.relevance_reasoning ?? "",
          relevanceLevel: signal.relevance_level ?? "",
          type: signal.type,
        });
        await supabase.from("signals").update({ slack_sent_at: new Date().toISOString() }).eq("id", signal.id);
      }
    }
  }

  return { account: account.name, newSignals: signalsToScore.length, scored: scoredSignals.length };
}

// How many completed-but-unscored runs to finalize per worker tick — same
// bounded-batch reasoning as WORKER_BATCH_SIZE above; any run past this
// count just gets picked up next tick instead of risking this function's
// own duration.
const FINALIZE_BATCH_SIZE = 20;

// Scores an account once every job in its crawl_run has finished (done or
// error) — called by the worker after each batch. A run still in progress
// is simply skipped and re-checked next tick, so this is self-healing if
// a run straddles more ticks than expected (a slow batch, a brief backlog)
// rather than scoring an account's signals before its crawl actually
// finished.
export async function finalizeCompletedRuns(supabase: AdminSupabase): Promise<CrawlSummary[]> {
  const { data: candidateRuns } = await supabase
    .from("crawl_runs")
    .select("*")
    .is("scored_at", null)
    .order("created_at", { ascending: true })
    .limit(FINALIZE_BATCH_SIZE);

  if (!candidateRuns || candidateRuns.length === 0) return [];

  const summaries: CrawlSummary[] = [];

  for (const run of candidateRuns) {
    const { count: unfinished } = await supabase
      .from("crawl_jobs")
      .select("id", { count: "exact", head: true })
      .eq("run_id", run.id)
      .in("status", ["pending", "running"]);

    if (unfinished && unfinished > 0) continue; // still in progress — try again next tick

    const { data: account } = await supabase.from("accounts").select("*").eq("id", run.account_id).single();
    if (!account) {
      await supabase.from("crawl_runs").update({ scored_at: new Date().toISOString() }).eq("id", run.id);
      continue;
    }

    try {
      summaries.push(await scoreAccountSignals(supabase, account));
    } catch (err) {
      console.error(`finalize/scoring failed for account ${account.name}:`, err);
      summaries.push({
        account: account.name,
        newSignals: 0,
        scored: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      await supabase.from("crawl_runs").update({ scored_at: new Date().toISOString() }).eq("id", run.id);
    }
  }

  return summaries;
}
