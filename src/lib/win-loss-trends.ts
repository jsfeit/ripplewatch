import "server-only";
import { identifyWinLossTrends, type WinLossTrendEntry, type WinLossTrendCandidateSignal } from "@/lib/anthropic";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type AdminSupabase = ReturnType<typeof createAdminClient>;
type Account = Database["public"]["Tables"]["accounts"]["Row"];

// Below this many total reasons, theme extraction is mostly noise — same
// threshold /api/trends/generate uses for the manual path.
const MIN_ENTRIES_FOR_TRENDS = 5;

function splitNotes(notes: string | null): string[] {
  if (!notes) return [];
  return notes
    .split(". ")
    .map((s) => s.trim())
    .filter(Boolean);
}

export type WinLossTrendsSummary = { account: string; generated: boolean; entries: number; skipped?: "too_few_entries" };

// Shared by the crawl self-heal (ensureWinLossTrends) and the monthly cron
// (see /api/cron/industry-trends, which now refreshes all three of
// industry trends, market profile, and this) — moved out of
// /api/trends/generate so the manual "Refresh" button and the automatic
// path run the exact same logic and can't drift apart.
//
// Also folds in customer-voice's scored feedback entries (NPS responses),
// not just win/loss deals — a detractor's reason and a lost-deal reason are
// the same kind of "why is this account losing ground" signal, and a
// promoter's reason is the same kind of signal a won-deal reason is. This
// is the concrete version of "tie customer-feedback trends to competitive
// intelligence": those reasons flow through the exact same theme-detection
// pass as win/loss already gets, including getting linked to the specific
// competitor signal that explains them (see identifyWinLossTrends). Passive
// (7-8) scores and unscored asks/feature-requests are deliberately left
// out — neither has the clear-cut won/lost framing this pass needs; asks
// stay visible in their own Customer voice list instead of being forced
// into a theme here.
export async function runWinLossTrendsForAccount(
  supabase: AdminSupabase,
  account: Account,
  competitors: { id: string; name: string }[]
): Promise<WinLossTrendsSummary> {
  const competitorIds = competitors.map((c) => c.id);
  const competitorNameById = new Map(competitors.map((c) => [c.id, c.name]));

  const [{ data: winLoss }, { data: feedback }] = await Promise.all([
    competitorIds.length
      ? supabase.from("competitor_win_loss").select("competitor_id, outcome, reason").in("competitor_id", competitorIds)
      : Promise.resolve({ data: [] }),
    supabase.from("account_customer_feedback").select("summary, score").eq("account_id", account.id).not("score", "is", null),
  ]);

  const entries: WinLossTrendEntry[] = [];
  for (const row of winLoss ?? []) {
    if (!row.reason) continue;
    entries.push({
      reason: row.reason,
      outcome: row.outcome === "churned" ? "lost" : row.outcome,
      competitorName: row.competitor_id ? (competitorNameById.get(row.competitor_id) ?? null) : null,
    });
  }
  for (const reason of splitNotes(account.lost_deal_notes)) entries.push({ reason, outcome: "lost", competitorName: null });
  for (const reason of splitNotes(account.won_deal_notes)) entries.push({ reason, outcome: "won", competitorName: null });
  for (const reason of splitNotes(account.churn_notes)) entries.push({ reason, outcome: "lost", competitorName: null });
  for (const row of feedback ?? []) {
    if (row.score === null || (row.score >= 7 && row.score <= 8)) continue; // passive — no clear direction
    entries.push({ reason: row.summary, outcome: row.score >= 9 ? "won" : "lost", competitorName: null });
  }

  if (entries.length < MIN_ENTRIES_FOR_TRENDS) {
    return { account: account.name, generated: false, entries: entries.length, skipped: "too_few_entries" };
  }

  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);
    const { data: signals } = competitorIds.length
      ? await supabase
          .from("signals")
          .select("id, title, type, occurred_on, relevance_reasoning, relevance_score")
          .in("competitor_id", competitorIds)
          .eq("scored", true)
          .gte("occurred_on", ninetyDaysAgo.toISOString().slice(0, 10))
          .order("relevance_score", { ascending: false })
          .limit(60)
      : { data: [] };

    const candidateSignals: WinLossTrendCandidateSignal[] = (signals ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      type: s.type,
      occurredOn: s.occurred_on,
      reasoning: s.relevance_reasoning,
    }));

    const trends = await identifyWinLossTrends(entries, candidateSignals, account.id);

    const generatedAt = new Date().toISOString();
    await supabase.from("win_loss_trends").delete().eq("account_id", account.id);
    if (trends.length > 0) {
      await supabase.from("win_loss_trends").insert(
        trends.map((t) => ({
          account_id: account.id,
          theme: t.theme,
          summary: t.summary,
          won_count: t.wonCount,
          lost_count: t.lostCount,
          example_reasons: t.exampleReasons,
          related_signals: t.relatedSignals,
          generated_at: generatedAt,
        }))
      );
    }
    return { account: account.name, generated: true, entries: entries.length };
  } catch (err) {
    console.error(`win/loss trends generation failed for ${account.name}:`, err);
    return { account: account.name, generated: false, entries: entries.length };
  }
}

// Self-heal for an account with no win_loss_trends row yet, same pattern as
// ensureIndustryTrends/ensureMarketProfile: fires at most once (the
// existence check below), so a crawl that runs daily doesn't call the LLM
// every time — the monthly cron is what keeps existing trends current
// after that.
export async function ensureWinLossTrends(
  supabase: AdminSupabase,
  account: Account,
  competitors: { id: string; name: string }[]
): Promise<void> {
  const { data: existing } = await supabase
    .from("win_loss_trends")
    .select("id")
    .eq("account_id", account.id)
    .limit(1)
    .maybeSingle();
  if (existing) return;

  await runWinLossTrendsForAccount(supabase, account, competitors);
}
