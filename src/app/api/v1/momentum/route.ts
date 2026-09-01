import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiRequest } from "@/lib/api-auth";
import { computeMomentum } from "@/lib/momentum";

// Same 60-day window and computeMomentum call the Trends page uses —
// deterministic, no LLM cost, so this is cheap to serve on every request.
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const supabase = createAdminClient();
  const { data: competitors } = await supabase
    .from("competitors")
    .select("id, name")
    .eq("account_id", auth.accountId);
  const competitorIds = (competitors ?? []).map((c) => c.id);

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 60);
  const { data: signals } = competitorIds.length
    ? await supabase
        .from("signals")
        .select("competitor_id, type, sentiment, occurred_on, scored, relevance_score")
        .in("competitor_id", competitorIds)
        .gte("occurred_on", sixtyDaysAgo.toISOString().slice(0, 10))
    : { data: [] };
  const { data: winLoss } = competitorIds.length
    ? await supabase.from("competitor_win_loss").select("competitor_id, outcome, created_at").in("competitor_id", competitorIds)
    : { data: [] };

  const data = (competitors ?? []).map((c) => {
    const forCompetitor = (signals ?? []).filter((s) => s.competitor_id === c.id);
    const winLossForCompetitor = (winLoss ?? []).filter((e) => e.competitor_id === c.id);
    const momentum = computeMomentum(forCompetitor, winLossForCompetitor);
    return { competitor_id: c.id, competitor_name: c.name, score: momentum.score, label: momentum.label };
  });

  return NextResponse.json({ data });
}
