import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiRequest } from "@/lib/api-auth";
import { computeMomentum } from "@/lib/momentum";

// Same computeMomentum call the Trends page uses — deterministic, no LLM
// cost, so this is cheap to serve on every request. 180-day lookback (not
// just the 60 days the recent/prior comparison itself needs) so
// computeMomentum's per-competitor reliability weighting has real history
// to judge from — see computeReliability in momentum.ts.
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const supabase = createAdminClient();
  const { data: competitors } = await supabase
    .from("competitors")
    .select("id, name")
    .eq("account_id", auth.accountId);
  const competitorIds = (competitors ?? []).map((c) => c.id);

  const reliabilityLookbackStart = new Date();
  reliabilityLookbackStart.setUTCDate(reliabilityLookbackStart.getUTCDate() - 180);
  const { data: signals } = competitorIds.length
    ? await supabase
        .from("signals")
        .select("competitor_id, type, sentiment, occurred_on, scored, relevance_score")
        .in("competitor_id", competitorIds)
        .gte("occurred_on", reliabilityLookbackStart.toISOString().slice(0, 10))
    : { data: [] };
  const { data: winLoss } = competitorIds.length
    ? await supabase.from("competitor_win_loss").select("competitor_id, outcome, created_at").in("competitor_id", competitorIds)
    : { data: [] };
  const { data: stateHistory } = competitorIds.length
    ? await supabase
        .from("competitor_state_history")
        .select("competitor_id, metric, value, recorded_at")
        .in("competitor_id", competitorIds)
        .gte("recorded_at", reliabilityLookbackStart.toISOString())
    : { data: [] };

  const data = (competitors ?? []).map((c) => {
    const forCompetitor = (signals ?? []).filter((s) => s.competitor_id === c.id);
    const winLossForCompetitor = (winLoss ?? []).filter((e) => e.competitor_id === c.id);
    const stateHistoryForCompetitor = (stateHistory ?? []).filter((e) => e.competitor_id === c.id);
    const momentum = computeMomentum(forCompetitor, winLossForCompetitor, stateHistoryForCompetitor);
    return { competitor_id: c.id, competitor_name: c.name, score: momentum.score, label: momentum.label };
  });

  return NextResponse.json({ data });
}
