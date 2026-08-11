import "server-only";
import {
  checkPricingDiff,
  checkPricingStructure,
  checkJobPostingsDiff,
  checkSeoTrafficDiff,
  checkProductHuntLaunches,
  checkNews,
  checkFunding,
  checkSearchNews,
  isFirstNewsCheck,
  ensureMonitoringUrls,
} from "@/lib/scraping";
import {
  scoreSignal,
  extractCompetitorMentions,
  researchCompanyContext,
  SCORING_PROMPT_VERSION,
  type CompetitorMention,
} from "@/lib/anthropic";
import { sendSlackAlert } from "@/lib/slack";
import { fetchRecentGongTranscripts } from "@/lib/gong";
import { fetchRecentZoomTranscripts } from "@/lib/zoom";
import { fetchClosedLostDealNotes } from "@/lib/hubspot";
import { fetchRecentIntercomChurnNotes } from "@/lib/intercom";
import { TIER_SIGNAL_SOURCES, COMPETITOR_LIMIT, CALL_INTEL_ALLOWED, CRM_ALLOWED, INTERCOM_ALLOWED } from "@/lib/tier-limits";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type AdminSupabase = ReturnType<typeof createAdminClient>;
type Account = Database["public"]["Tables"]["accounts"]["Row"];
type Signal = Database["public"]["Tables"]["signals"]["Row"];

// Runs fn over items with at most `concurrency` in flight at once, instead
// of either a fully sequential loop (too slow once each item does several
// LLM calls) or an unbounded Promise.all (risks bursting past API rate
// limits). A plain sequential for-loop across competitors — each now doing
// several sequential LLM calls of its own after the news/funding dedup
// changes — is what pushed a 9-competitor recrawl past Vercel's 300s
// function timeout; this is the fix.
async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
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

function startOfWeek(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString();
}

export type CrawlSummary = { account: string; newSignals: number; scored: number };

// The full per-account crawl: check every allowed signal source for each of
// the account's tracked competitors, score whatever's new, and push High
// relevance to Slack. Shared between the scheduled cron (loops every
// account) and the admin single-account recrawl route — same logic either
// way, just a different set of accounts to iterate.
export async function runCrawlForAccount(supabase: AdminSupabase, account: Account): Promise<CrawlSummary> {
  const { data: allCompetitors } = await supabase
    .from("competitors")
    .select("*")
    .eq("account_id", account.id)
    .order("created_at", { ascending: true });

  // If the account has more competitors than its current tier allows (e.g.
  // downgraded after adding them under a higher tier), only the
  // earliest-added ones up to the limit stay actively monitored — matches
  // what Settings displays as "Not monitored" for the rest.
  const competitors = (allCompetitors ?? []).slice(0, COMPETITOR_LIMIT[account.tier]);

  const allowedSources = TIER_SIGNAL_SOURCES[account.tier];

  // Competitors run concurrently (bounded — see mapWithConcurrency), not one
  // at a time: each one can now make several sequential LLM calls (news
  // check, funding check, each with its own relevance + dedup pass), and a
  // plain sequential loop across every tracked competitor was what pushed a
  // 9-competitor recrawl past Vercel's 300s timeout. Concurrency is safe
  // across different competitors — the only sequencing requirement (news
  // before funding, for dedup) is within a single competitor's own checks,
  // preserved below.
  const COMPETITOR_CONCURRENCY = 4;
  const perCompetitorSignals = await mapWithConcurrency(competitors, COMPETITOR_CONCURRENCY, async (rawCompetitor) => {
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
    if (allowedSources.includes("news")) {
      found.push(...(await checkNews(supabase, competitor, isFirstCheck)));
    }
    if (allowedSources.includes("funding")) {
      found.push(...(await checkFunding(supabase, competitor, isFirstCheck)));
    }

    // Pricing/jobs surface at most one signal per run (a diff against the
    // last snapshot) — normalized to arrays here so both shapes flatten into
    // `found` the same way as the sequential checks above.
    const checks = [
      allowedSources.includes("pricing") ? checkPricingDiff(supabase, competitor).then((s) => (s ? [s] : [])) : null,
      allowedSources.includes("job_posting")
        ? checkJobPostingsDiff(supabase, competitor).then((s) => (s ? [s] : []))
        : null,
      // Its own weekly gate lives inside checkSeoTrafficDiff (see
      // SEO_CHECK_INTERVAL_DAYS in scraping.ts) rather than here, so it's a
      // no-op most crawl runs regardless of how often crawls themselves run.
      allowedSources.includes("seo") ? checkSeoTrafficDiff(supabase, competitor).then((s) => (s ? [s] : [])) : null,
      // Free API (stubbed pending a real token — see producthunt-data.ts);
      // own weekly gate lives inside checkProductHuntLaunches, same pattern
      // as SEO above. Piggybacks on the "news" tier gate rather than a new
      // TIER_SIGNAL_SOURCES entry since it inserts plain "news"-type signals.
      allowedSources.includes("news") ? checkProductHuntLaunches(supabase, competitor) : null,
      // Supplements the free RSS news check above with Claude web search —
      // off by default (real per-search cost, not modeled against tier
      // pricing yet). Enable per the web-search-news-decision checklist item.
      allowedSources.includes("news") && process.env.ENABLE_WEB_SEARCH_NEWS === "true"
        ? checkSearchNews(supabase, competitor, account.id)
        : null,
    ].filter((p): p is Promise<Signal[]> => p !== null);

    const results = await Promise.allSettled(checks);
    for (const result of results) {
      if (result.status === "fulfilled") found.push(...result.value);
    }

    // Refreshes the Pricing dashboard's current-state snapshot every run,
    // independent of whether a diff signal fired — runs before the
    // no-new-signals early-return below so it isn't skipped.
    if (allowedSources.includes("pricing")) {
      await checkPricingStructure(supabase, competitor).catch((err) =>
        console.error(`pricing structure extraction failed for ${competitor.name}:`, err)
      );
    }

    return found;
  });

  const newSignals: Signal[] = perCompetitorSignals.flat();

  const competitorIds = competitors.map((c) => c.id);

  // Leftover unscored signals from a previous run that got cut short (e.g. a
  // Vercel timeout mid-crawl) — checkNews/checkFunding only insert headlines
  // they haven't already seen by title, so a signal left at scored:false
  // after an interrupted run would otherwise never be revisited. Folded into
  // this run's scoring pass so nothing stays permanently stuck as "Raw".
  // Capped and oldest-first: an unbounded rescue would retry the whole
  // backlog on every run, which is exactly the runaway-duration failure
  // mode that produced this backlog in the first place. Any excess just
  // gets picked up a few signals at a time over subsequent runs instead.
  const STALE_RESCUE_LIMIT = 20;
  const { data: staleUnscored } = await supabase
    .from("signals")
    .select("*")
    .in("competitor_id", competitorIds)
    .eq("scored", false)
    .not("id", "in", `(${[...newSignals.map((s) => s.id), "00000000-0000-0000-0000-000000000000"].join(",")})`)
    .order("created_at", { ascending: true })
    .limit(STALE_RESCUE_LIMIT);

  const signalsToScore: Signal[] = [...newSignals, ...(staleUnscored ?? [])];

  if (signalsToScore.length === 0) {
    return { account: account.name, newSignals: 0, scored: 0 };
  }

  // Starter is teaser-scored: at most one scored alert per week. Plus and
  // Advanced score every new signal.
  let alreadyScoredThisWeek = false;
  if (account.tier === "starter") {
    const { count } = await supabase
      .from("signals")
      .select("id", { count: "exact", head: true })
      .in("competitor_id", competitorIds)
      .eq("scored", true)
      .gte("created_at", startOfWeek());
    alreadyScoredThisWeek = Boolean(count && count > 0);
  }

  const callMentions = CALL_INTEL_ALLOWED[account.tier]
    ? await buildCallMentions(
        supabase,
        account.id,
        competitors.map((c) => c.name)
      )
    : [];

  const hubspotNotes = CRM_ALLOWED[account.tier] ? await buildHubspotNotes(supabase, account.id) : null;
  const lostDealNotes = [account.lost_deal_notes, hubspotNotes].filter(Boolean).join(" ") || null;

  const intercomNotes = INTERCOM_ALLOWED[account.tier] ? await buildIntercomNotes(supabase, account.id) : null;
  const churnNotes = [account.churn_notes, intercomNotes].filter(Boolean).join(" ") || null;

  const companyResearch = await ensureCompanyResearch(supabase, account);

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

  if (account.tier === "starter") {
    // Starter scores at most one signal total, so there's nothing to gain
    // from concurrency here — stays sequential so the "already scored one
    // this week" check can short-circuit immediately.
    for (const signal of signalsToScore) {
      if (alreadyScoredThisWeek || scoredSignals.length > 0) break;
      const scored = await scoreOneSignal(signal);
      if (scored) scoredSignals.push(scored);
    }
  } else {
    // Plus/Advanced score every new signal — the backlog rescue cap (20)
    // bounds how many that can ever be in one run, so concurrency here is
    // both safe and the main lever on total crawl duration.
    const SCORE_CONCURRENCY = 5;
    const results = await mapWithConcurrency(signalsToScore, SCORE_CONCURRENCY, scoreOneSignal);
    for (const result of results) {
      if (result) scoredSignals.push(result);
    }
  }

  // Real-time push happens here, at detection time — but only for High
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
        });
        await supabase.from("signals").update({ slack_sent_at: new Date().toISOString() }).eq("id", signal.id);
      }
    }
  }

  return { account: account.name, newSignals: newSignals.length, scored: scoredSignals.length };
}
