import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPricingDiff, checkPricingStructure, checkJobPostingsDiff, checkNews, checkFunding } from "@/lib/scraping";
import { scoreSignal, extractCompetitorMentions, type CompetitorMention } from "@/lib/anthropic";
import { sendSlackAlert } from "@/lib/slack";
import { fetchRecentGongTranscripts } from "@/lib/gong";
import { fetchRecentZoomTranscripts } from "@/lib/zoom";
import { fetchClosedLostDealNotes } from "@/lib/hubspot";
import { TIER_SIGNAL_SOURCES, COMPETITOR_LIMIT, CALL_INTEL_ALLOWED, CRM_ALLOWED } from "@/lib/tier-limits";
import type { Database } from "@/lib/supabase/types";

export const maxDuration = 300; // Vercel Cron functions get a longer budget than normal requests

type Signal = Database["public"]["Tables"]["signals"]["Row"];

// Pulls recent Gong/Zoom call transcripts (if connected) and distills them
// down to competitor-mention sentences via Claude. Fetched once per account
// per cron run, not per-signal — it's the same context for every signal
// scored in this run, and each provider call is expensive enough to want to
// avoid repeating it per competitor. Mentions stay tagged per-competitor so a
// signal about Competitor A never gets scored using a mention about
// Competitor B.
async function buildCallMentions(
  supabase: ReturnType<typeof createAdminClient>,
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

  return extractCompetitorMentions(transcripts, competitorNames);
}

// HubSpot's closed-lost deal reasons, refreshed each run — supplements
// (doesn't replace) whatever the account typed in manually during
// onboarding, so scoring reflects deals lost since then too.
async function buildHubspotNotes(
  supabase: ReturnType<typeof createAdminClient>,
  accountId: string
): Promise<string | null> {
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

function startOfWeek(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString();
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: accounts } = await supabase.from("accounts").select("*");

  const summary: Record<string, unknown>[] = [];

  for (const account of accounts ?? []) {
    const { data: allCompetitors } = await supabase
      .from("competitors")
      .select("*")
      .eq("account_id", account.id)
      .order("created_at", { ascending: true });

    // If the account has more competitors than its current tier allows
    // (e.g. downgraded after adding them under a higher tier), only the
    // earliest-added ones up to the limit stay actively monitored — matches
    // what Settings displays as "Not monitored" for the rest.
    const competitors = (allCompetitors ?? []).slice(0, COMPETITOR_LIMIT[account.tier]);

    const allowedSources = TIER_SIGNAL_SOURCES[account.tier];

    const newSignals: Signal[] = [];
    for (const competitor of competitors) {
      const checks = [
        allowedSources.includes("pricing") ? checkPricingDiff(supabase, competitor) : null,
        allowedSources.includes("job_posting") ? checkJobPostingsDiff(supabase, competitor) : null,
        allowedSources.includes("news") ? checkNews(supabase, competitor) : null,
        allowedSources.includes("funding") ? checkFunding(supabase, competitor) : null,
      ].filter((p): p is Promise<Signal | null> => p !== null);

      const results = await Promise.allSettled(checks);
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) newSignals.push(result.value);
      }

      // Refreshes the Pricing dashboard's current-state snapshot every run,
      // independent of whether a diff signal fired — runs before the
      // no-new-signals early-continue below so it isn't skipped.
      if (allowedSources.includes("pricing")) {
        await checkPricingStructure(supabase, competitor).catch((err) =>
          console.error(`pricing structure extraction failed for ${competitor.name}:`, err)
        );
      }
    }

    if (newSignals.length === 0) {
      summary.push({ account: account.name, newSignals: 0 });
      continue;
    }

    // Starter is teaser-scored: at most one scored alert per week. Plus and
    // Advanced score every new signal.
    let alreadyScoredThisWeek = false;
    if (account.tier === "starter") {
      const competitorIds = competitors.map((c) => c.id);
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

    const scoredSignals: (Signal & { competitorName: string })[] = [];

    for (const signal of newSignals) {
      const shouldScore = account.tier !== "starter" ? true : !alreadyScoredThisWeek && scoredSignals.length === 0;
      if (!shouldScore) continue;

      const competitor = competitors.find((c) => c.id === signal.competitor_id);
      if (!competitor) continue;

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
            churnNotes: account.churn_notes,
            callInsights,
          },
          { competitorName: competitor.name, type: signal.type, title: signal.title, summary: signal.summary }
        );

        const { data: updated } = await supabase
          .from("signals")
          .update({ scored: true, relevance_level: result.level, relevance_reasoning: result.reasoning })
          .eq("id", signal.id)
          .select("*")
          .single();

        if (updated) scoredSignals.push({ ...updated, competitorName: competitor.name });
      } catch (err) {
        console.error(`scoring failed for signal ${signal.id}:`, err);
      }
    }

    // Real-time push happens here, at detection time — but only for High
    // relevance, and only to Slack. Medium/Low (and unscored raw signals)
    // are deliberately left alone: they're picked up by the daily and
    // weekly digest crons instead, keyed off relevance_level so a signal is
    // never pushed AND digested twice through the same channel. See
    // /api/cron/digest-daily and /api/cron/digest-weekly.
    const highRelevanceSignals = scoredSignals.filter((s) => s.relevance_level === "High");
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
          await sendSlackAlert(
            slackIntegration.credentials as Parameters<typeof sendSlackAlert>[0],
            {
              competitorName: signal.competitorName,
              title: signal.title,
              reasoning: signal.relevance_reasoning ?? "",
              relevanceLevel: signal.relevance_level ?? "",
            }
          );
          await supabase.from("signals").update({ slack_sent_at: new Date().toISOString() }).eq("id", signal.id);
        }
      }
    }

    summary.push({ account: account.name, newSignals: newSignals.length, scored: scoredSignals.length });
  }

  return NextResponse.json({ ok: true, summary });
}
