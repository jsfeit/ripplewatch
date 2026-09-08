import "server-only";
import { generateDigestVerdict, generateMomentumDigest, type VerdictSignal, type MomentumDigestInput } from "@/lib/anthropic";
import { computeMomentum } from "@/lib/momentum";
import type { Database } from "@/lib/supabase/types";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminSupabase = ReturnType<typeof createAdminClient>;
type Account = Database["public"]["Tables"]["accounts"]["Row"];

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type WeeklyAccountIntelligence = {
  verdict: string | null;
  trendsDigest: string | null;
};

// Shared by the weekly email cron (digest-weekly) and the weekly Slack
// digest cron (slack-digest-weekly): both need the same account-level
// rollup — a synthesized verdict of the week's High/Medium signals plus a
// momentum takeaway — just delivered through different channels on
// different schedules (the email cron fires once for every account on a
// single Monday-UTC slot; the Slack cron fires per-account whenever that
// account's own local, Sunday-night-by-default window comes around).
// Regenerating here rather than reading back whichever ran most recently
// keeps both deliveries current as of their own send time, instead of one
// of them silently serving up to 6-day-stale content between schedules.
export async function generateWeeklyAccountIntelligence(
  supabase: AdminSupabase,
  account: Account,
  competitors: { id: string; name: string }[]
): Promise<WeeklyAccountIntelligence> {
  const competitorIds = competitors.map((c) => c.id);
  if (competitorIds.length === 0) return { verdict: null, trendsDigest: null };

  let verdict: string | null = null;
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
  const { data: weekSignals } = await supabase
    .from("signals")
    .select("*")
    .in("competitor_id", competitorIds)
    .in("relevance_level", ["High", "Medium"])
    .gte("created_at", sevenDaysAgo)
    .neq("source", "backfill");

  if (weekSignals && weekSignals.length > 0) {
    try {
      const verdictSignals: VerdictSignal[] = weekSignals.map((s) => ({
        competitorName: competitors.find((c) => c.id === s.competitor_id)?.name ?? "Unknown",
        title: s.title,
        relevanceLevel: s.relevance_level ?? "Medium",
        relevanceReasoning: s.relevance_reasoning,
      }));
      verdict = await generateDigestVerdict(
        {
          companyName: account.name,
          positioning: account.positioning,
          icp: account.icp,
          lostDealNotes: account.lost_deal_notes,
          churnNotes: account.churn_notes,
          companyResearch: account.company_research,
        },
        verdictSignals,
        account.id
      );
      if (verdict) {
        await supabase
          .from("accounts")
          .update({ weekly_verdict: verdict, weekly_verdict_generated_at: new Date().toISOString() })
          .eq("id", account.id);
      }
    } catch (err) {
      console.error(`weekly verdict generation failed for ${account.name}:`, err);
    }
  }

  let trendsDigest: string | null = null;
  try {
    const { data: accountWinLoss } = await supabase
      .from("competitor_win_loss")
      .select("competitor_id, outcome, created_at")
      .in("competitor_id", competitorIds);

    // 180-day lookback (not just the 60 days the recent/prior comparison
    // itself needs) so computeMomentum's per-competitor reliability
    // weighting has real history to judge from — see computeReliability in
    // momentum.ts.
    const reliabilityLookbackStart = new Date();
    reliabilityLookbackStart.setUTCDate(reliabilityLookbackStart.getUTCDate() - 180);
    const { data: momentumSignals } = await supabase
      .from("signals")
      .select("competitor_id, type, sentiment, occurred_on, scored, relevance_score")
      .in("competitor_id", competitorIds)
      .gte("occurred_on", reliabilityLookbackStart.toISOString().slice(0, 10));
    const { data: momentumStateHistory } = await supabase
      .from("competitor_state_history")
      .select("competitor_id, metric, value, recorded_at")
      .in("competitor_id", competitorIds)
      .gte("recorded_at", reliabilityLookbackStart.toISOString());

    const momentumInputs: MomentumDigestInput[] = competitors.map((c) => {
      const forCompetitor = (momentumSignals ?? []).filter((s) => s.competitor_id === c.id);
      const winLossForCompetitor = (accountWinLoss ?? []).filter((e) => e.competitor_id === c.id);
      const stateHistoryForCompetitor = (momentumStateHistory ?? []).filter((e) => e.competitor_id === c.id);
      const momentum = computeMomentum(forCompetitor, winLossForCompetitor, stateHistoryForCompetitor);
      return {
        competitorName: c.name,
        score: momentum.score,
        label: momentum.label,
        hiringDelta: momentum.components.hiring.detail,
        pricingDelta: momentum.components.pricing.detail,
        productChangeDelta: momentum.components.productChange.detail,
        pressDelta: momentum.components.pressAndFunding.detail,
        winRateDelta: momentum.components.winRate.detail,
        productActivityDelta:
          momentum.components.productActivity.detail === "no data" ? null : momentum.components.productActivity.detail,
      };
    });

    trendsDigest = await generateMomentumDigest(account.name, momentumInputs, account.id);
    if (trendsDigest) {
      await supabase
        .from("accounts")
        .update({ trends_digest: trendsDigest, trends_digest_generated_at: new Date().toISOString() })
        .eq("id", account.id);
    }
  } catch (err) {
    console.error(`trends digest generation failed for ${account.name}:`, err);
  }

  return { verdict, trendsDigest };
}
