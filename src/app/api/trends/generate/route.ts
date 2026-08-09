import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { identifyWinLossTrends, type WinLossTrendEntry, type WinLossTrendCandidateSignal } from "@/lib/anthropic";

// LLM-heavy but bounded (one call, capped entry/signal counts in
// anthropic.ts) — a generous ceiling in case an account has a lot of
// logged win/loss history, same reasoning as the fact-sheet route.
export const maxDuration = 60;

// Below this many total reasons, theme extraction is mostly noise — the
// model is explicitly told to return an empty list rather than force
// themes from too little data, but it's cheaper to just not call it.
const MIN_ENTRIES_FOR_TRENDS = 5;

// Splits the pre-aggregated lost_deal_notes/won_deal_notes blob (see
// win-loss-import.ts — reasons are joined with ". " and deduped when
// written) back into individual reason-shaped strings. Imperfect —
// there's no way to perfectly reverse a concatenation — but good enough
// to give the model real, distinct examples instead of one giant blob.
function splitNotes(notes: string | null): string[] {
  if (!notes) return [];
  return notes
    .split(". ")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("account_id").eq("id", user.id).single();
  if (!profile?.account_id) {
    return NextResponse.json({ error: "No account." }, { status: 400 });
  }
  const accountId = profile.account_id;

  const { data: account } = await supabase
    .from("accounts")
    .select("lost_deal_notes, won_deal_notes")
    .eq("id", accountId)
    .single();

  const { data: competitors } = await supabase.from("competitors").select("id, name").eq("account_id", accountId);
  const competitorIds = (competitors ?? []).map((c) => c.id);
  const competitorNameById = new Map((competitors ?? []).map((c) => [c.id, c.name]));

  const { data: winLoss } = competitorIds.length
    ? await supabase.from("competitor_win_loss").select("competitor_id, outcome, reason").in("competitor_id", competitorIds)
    : { data: [] };

  const entries: WinLossTrendEntry[] = [];
  for (const row of winLoss ?? []) {
    if (!row.reason) continue;
    entries.push({
      reason: row.reason,
      outcome: row.outcome,
      competitorName: competitorNameById.get(row.competitor_id) ?? null,
    });
  }
  for (const reason of splitNotes(account?.lost_deal_notes ?? null)) {
    entries.push({ reason, outcome: "lost", competitorName: null });
  }
  for (const reason of splitNotes(account?.won_deal_notes ?? null)) {
    entries.push({ reason, outcome: "won", competitorName: null });
  }

  if (entries.length < MIN_ENTRIES_FOR_TRENDS) {
    return NextResponse.json({ trends: [], generatedAt: null, totalEntries: entries.length, insufficientData: true });
  }

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

  const trends = await identifyWinLossTrends(entries, candidateSignals, accountId);

  const generatedAt = new Date().toISOString();
  await supabase.from("win_loss_trends").delete().eq("account_id", accountId);
  if (trends.length > 0) {
    await supabase.from("win_loss_trends").insert(
      trends.map((t) => ({
        account_id: accountId,
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

  return NextResponse.json({ trends, generatedAt, totalEntries: entries.length, insufficientData: false });
}
