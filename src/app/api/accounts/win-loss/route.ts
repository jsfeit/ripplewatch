import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeMomentum } from "@/lib/momentum";
import type { WinLossOutcome } from "@/lib/supabase/types";

// Account-level counterpart to /api/competitors/[id]/win-loss: that route
// requires a competitor in the URL path itself, which structurally can't
// express "I lost this deal, don't know who to" or "this customer
// churned, no idea where they went" — the common case per
// 0061_win_loss_unattributed_and_churn. This is the one route the
// win/loss UI now posts every manual entry through (won/lost/churned,
// competitor optional), replacing both the old per-competitor form submit
// and the separate /api/accounts/churn text-blob endpoint.
//
// An entry with no competitor also still rolls into the account's
// lost_deal_notes/won_deal_notes/churn_notes blob, same reasoning as
// win-loss-import.ts's general bucket: those blobs feed narrative LLM
// context (scoring prompts, fact sheets), the structured row feeds dated
// aggregate stats and the unattributed-attrition correlation.
const NOTES_MAX_CHARS = 6000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const competitorId = typeof body?.competitorId === "string" && body.competitorId ? body.competitorId : null;
  const outcome = body?.outcome as WinLossOutcome | undefined;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (outcome !== "won" && outcome !== "lost" && outcome !== "churned") {
    return NextResponse.json({ error: "outcome must be \"won\", \"lost\", or \"churned\"." }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "A reason is required." }, { status: 400 });
  }

  const { data: profile } = await supabase.from("profiles").select("account_id").eq("id", user.id).single();
  if (!profile?.account_id) {
    return NextResponse.json({ error: "No account." }, { status: 400 });
  }
  const accountId = profile.account_id;

  const { data, error } = await supabase
    .from("competitor_win_loss")
    .insert({ account_id: accountId, competitor_id: competitorId, outcome, reason, created_by: user.id })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!competitorId) {
    const { data: account } = await supabase
      .from("accounts")
      .select("lost_deal_notes, won_deal_notes, churn_notes")
      .eq("id", accountId)
      .single();
    const existingNotes =
      (outcome === "lost" ? account?.lost_deal_notes : outcome === "won" ? account?.won_deal_notes : account?.churn_notes) ??
      "";
    let combined = existingNotes ? `${existingNotes} ${reason}.` : `${reason}.`;
    if (combined.length > NOTES_MAX_CHARS) combined = combined.slice(combined.length - NOTES_MAX_CHARS);
    const patch =
      outcome === "lost"
        ? { lost_deal_notes: combined }
        : outcome === "won"
          ? { won_deal_notes: combined }
          : { churn_notes: combined };
    await supabase.from("accounts").update(patch).eq("id", accountId);
  }

  // Only a competitor-attributed entry can move that competitor's own
  // Momentum win-rate component — an unattributed entry has no single
  // competitor to fairly credit or blame, so it's surfaced through the
  // unattributed-attrition correlation (churn-correlation.ts) instead of
  // any score.
  let momentum: { score: number | null; label: string; confidence: string } | null = null;
  if (competitorId) {
    const reliabilityLookbackStart = new Date();
    reliabilityLookbackStart.setUTCDate(reliabilityLookbackStart.getUTCDate() - 180);
    const { data: momentumSignals } = await supabase
      .from("signals")
      .select("competitor_id, type, sentiment, occurred_on, scored, relevance_score")
      .eq("competitor_id", competitorId)
      .gte("occurred_on", reliabilityLookbackStart.toISOString().slice(0, 10));
    const { data: momentumWinLoss } = await supabase
      .from("competitor_win_loss")
      .select("competitor_id, outcome, created_at")
      .eq("competitor_id", competitorId);
    const { data: momentumStateHistory } = await supabase
      .from("competitor_state_history")
      .select("competitor_id, metric, value, recorded_at")
      .eq("competitor_id", competitorId)
      .gte("recorded_at", reliabilityLookbackStart.toISOString());
    const computed = computeMomentum(momentumSignals ?? [], momentumWinLoss ?? [], momentumStateHistory ?? []);
    momentum = { score: computed.score, label: computed.label, confidence: computed.confidence };
  }

  return NextResponse.json({ entry: data, momentum });
}
