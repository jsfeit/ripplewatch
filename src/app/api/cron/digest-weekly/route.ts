import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDigestEmail, type DigestSignal } from "@/lib/resend";
import { generateDigestVerdict, generateMomentumDigest, type VerdictSignal, type MomentumDigestInput } from "@/lib/anthropic";
import { computeMomentum } from "@/lib/momentum";
import { mapWithConcurrency } from "@/lib/crawl";
import type { Database } from "@/lib/supabase/types";

type Signal = Database["public"]["Tables"]["signals"]["Row"];
type Account = Database["public"]["Tables"]["accounts"]["Row"];

// Bounded the same way digest-daily/crawl fan out across accounts — each
// account here does a verdict LLM call plus a momentum-digest LLM call, so
// this is squarely in the "expensive enough to bound, not run unbounded"
// category, not just left fully sequential.
const ACCOUNT_CONCURRENCY = 5;

// Runs once a week. Catches everything the daily digest deliberately skips:
// Low relevance signals and raw (unscored) signals — real, but not urgent
// enough to justify a same-day interruption. Rolling these into a weekly
// email instead of a daily one is the whole point of tiering delivery by
// relevance in the first place; without it, every account still gets a
// daily flood, just relabeled.
//
// Also computes a separate weekly "verdict" — a rollup of the week's actual
// High/Medium activity (already emailed daily, so re-sending isn't the
// point), stored once on the account and reused by both this email's intro
// and the News dashboard banner. Deliberately independent of the low-
// priority query/early-return above: a quiet week for leftover noise
// shouldn't skip the rollup of what was actually a busy week for real
// signals, and vice versa.
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Threshold for the win/loss nudge riding along on this email — see below.
const WIN_LOSS_STALE_DAYS = 30;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  const supabase = createAdminClient();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .not("contact_email", "is", null)
    .eq("status", "active");

  const summary = await mapWithConcurrency(accounts ?? [], ACCOUNT_CONCURRENCY, async (account: Account) => {
    if (!account.contact_email) return null;

    const { data: competitors } = await supabase
      .from("competitors")
      .select("id, name")
      .eq("account_id", account.id);
    const competitorIds = (competitors ?? []).map((c) => c.id);
    if (competitorIds.length === 0) return null;

    const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
    const { data: weekSignals } = await supabase
      .from("signals")
      .select("*")
      .in("competitor_id", competitorIds)
      .in("relevance_level", ["High", "Medium"])
      .gte("created_at", sevenDaysAgo)
      .neq("source", "backfill");

    let verdict: string | null = null;
    if (weekSignals && weekSignals.length > 0) {
      try {
        const verdictSignals: VerdictSignal[] = weekSignals.map((s) => ({
          competitorName: competitors?.find((c) => c.id === s.competitor_id)?.name ?? "Unknown",
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

    // Fetched once, shared by the momentum digest below and the win/loss
    // staleness nudge further down — both need to know what's logged for
    // this account's competitors.
    const { data: accountWinLoss } = await supabase
      .from("competitor_win_loss")
      .select("competitor_id, outcome, created_at")
      .in("competitor_id", competitorIds);

    // Separate from the verdict above: that one synthesizes scored NEWS
    // signals, this one reads momentum itself (hiring/pricing/press deltas,
    // same computeMomentum already used by the Trends dashboard and
    // /api/v1/momentum) and names which competitors are actually moving —
    // shown at the top of the Dashboard's Trends section, not in the email.
    try {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 60);
      const { data: momentumSignals } = await supabase
        .from("signals")
        .select("competitor_id, type, sentiment, occurred_on, scored, relevance_score")
        .in("competitor_id", competitorIds)
        .gte("occurred_on", sixtyDaysAgo.toISOString().slice(0, 10));

      const momentumInputs: MomentumDigestInput[] = (competitors ?? []).map((c) => {
        const forCompetitor = (momentumSignals ?? []).filter((s) => s.competitor_id === c.id);
        const winLossForCompetitor = (accountWinLoss ?? []).filter((e) => e.competitor_id === c.id);
        const momentum = computeMomentum(forCompetitor, winLossForCompetitor);
        return {
          competitorName: c.name,
          score: momentum.score,
          label: momentum.label,
          hiringDelta: momentum.components.hiring.detail,
          pricingDelta: momentum.components.pricing.detail,
          pressDelta: momentum.components.pressAndFunding.detail,
          winRateDelta: momentum.components.winRate.detail,
        };
      });

      const trendsDigest = await generateMomentumDigest(account.name, momentumInputs, account.id);
      if (trendsDigest) {
        await supabase
          .from("accounts")
          .update({ trends_digest: trendsDigest, trends_digest_generated_at: new Date().toISOString() })
          .eq("id", account.id);
      }
    } catch (err) {
      console.error(`trends digest generation failed for ${account.name}:`, err);
    }

    const { data: signals } = await supabase
      .from("signals")
      .select("*")
      .in("competitor_id", competitorIds)
      .is("email_digest_sent_at", null)
      .or("relevance_level.eq.Low,scored.eq.false")
      // Backfill (a competitor's first-ever crawl, seeding landscape context
      // for a new account) is deliberately excluded from digests too — this
      // email is "what happened recently," not "here's the history."
      .neq("source", "backfill");

    const pending = (signals ?? []) as Signal[];
    if (pending.length === 0) {
      return { account: account.name, sent: 0, verdict: Boolean(verdict) };
    }

    const digestSignals: DigestSignal[] = pending.map((s) => ({
      competitorName: competitors?.find((c) => c.id === s.competitor_id)?.name ?? "Unknown",
      title: s.title,
      scored: s.scored,
      relevanceLevel: s.relevance_level,
      relevanceReasoning: s.relevance_reasoning,
    }));

    // Piggybacks on this send rather than triggering a separate email (see
    // sendDigestEmail's winLossNudge param) — reaches someone only when the
    // digest was already going out for real signals, never becoming its
    // own source of inbox noise. Nudges when nothing's ever been logged, or
    // when the most recent entry has gone stale.
    const winLossNudge = (() => {
      const entries = accountWinLoss ?? [];
      if (entries.length === 0) {
        return `You haven't logged any win/loss data yet — even one entry sharpens fact sheets and starts feeding Momentum's win-rate trend. <a href="${appUrl}/app/win-loss">Log one</a>.`;
      }
      const mostRecent = entries.reduce(
        (latest, e) => Math.max(latest, new Date(e.created_at).getTime()),
        0
      );
      const daysSinceLastEntry = (Date.now() - mostRecent) / (24 * 60 * 60 * 1000);
      if (daysSinceLastEntry > WIN_LOSS_STALE_DAYS) {
        return `It's been over ${WIN_LOSS_STALE_DAYS} days since your last logged win/loss — a recent one keeps Momentum's win-rate trend accurate. <a href="${appUrl}/app/win-loss">Log one</a>.`;
      }
      return null;
    })();

    try {
      await sendDigestEmail(account.contact_email, account.name, digestSignals, "weekly", verdict, winLossNudge);
    } catch (err) {
      console.error(`weekly digest send failed for ${account.name}:`, err);
      return { account: account.name, sent: 0, error: true, verdict: Boolean(verdict) };
    }

    await supabase
      .from("signals")
      .update({ email_digest_sent_at: new Date().toISOString() })
      .in("id", pending.map((s) => s.id));

    return { account: account.name, sent: pending.length, verdict: Boolean(verdict) };
  });

  return NextResponse.json({ ok: true, summary: summary.filter(Boolean) });
}
