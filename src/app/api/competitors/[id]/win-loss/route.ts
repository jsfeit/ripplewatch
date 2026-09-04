import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeMomentum } from "@/lib/momentum";
import type { WinLossOutcome } from "@/lib/supabase/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const outcome = body?.outcome as WinLossOutcome | undefined;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (outcome !== "won" && outcome !== "lost") {
    return NextResponse.json({ error: "outcome must be 'won' or 'lost'." }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "A reason is required." }, { status: 400 });
  }

  // RLS scopes the insert to competitors belonging to the caller's own
  // account — no explicit ownership check needed beyond being signed in.
  const { data, error } = await supabase
    .from("competitor_win_loss")
    .insert({ competitor_id: id, outcome, reason, created_by: user.id })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Immediate payoff, same pattern as POST /api/v1/win-loss: show the
  // logging person the Momentum shift right away instead of making them
  // navigate to the dashboard to discover it happened.
  // 180-day lookback (not just the 60 days the recent/prior comparison
  // itself needs) so computeMomentum's per-competitor reliability
  // weighting has real history to judge from — see computeReliability in
  // momentum.ts.
  const reliabilityLookbackStart = new Date();
  reliabilityLookbackStart.setUTCDate(reliabilityLookbackStart.getUTCDate() - 180);
  const { data: momentumSignals } = await supabase
    .from("signals")
    .select("competitor_id, type, sentiment, occurred_on, scored, relevance_score")
    .eq("competitor_id", id)
    .gte("occurred_on", reliabilityLookbackStart.toISOString().slice(0, 10));
  const { data: momentumWinLoss } = await supabase
    .from("competitor_win_loss")
    .select("competitor_id, outcome, created_at")
    .eq("competitor_id", id);
  const { data: momentumStateHistory } = await supabase
    .from("competitor_state_history")
    .select("competitor_id, metric, value, recorded_at")
    .eq("competitor_id", id)
    .gte("recorded_at", reliabilityLookbackStart.toISOString());
  const computed = computeMomentum(momentumSignals ?? [], momentumWinLoss ?? [], momentumStateHistory ?? []);

  return NextResponse.json({
    entry: data,
    momentum: { score: computed.score, label: computed.label, confidence: computed.confidence },
  });
}
