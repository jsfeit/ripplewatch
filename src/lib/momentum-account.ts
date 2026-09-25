import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { computeMomentum, type MomentumResult } from "@/lib/momentum";

type Admin = SupabaseClient<Database>;

export type CompetitorMomentum = { competitor: { id: string; name: string }; momentum: MomentumResult };

// One place that knows how to load the inputs computeMomentum needs and run
// it per competitor, shared by the REST momentum route, the win/loss route's
// "did this shift the score" payoff, and the MCP tools — so the three can't
// drift apart on the lookback window or which tables feed the score.
//
// Deterministic, no LLM cost. 180-day lookback (not just the 60 days the
// recent/prior comparison itself needs) so computeMomentum's per-competitor
// reliability weighting has real history to judge from — see
// computeReliability in momentum.ts.
export async function loadCompetitorMomentum(
  supabase: Admin,
  accountId: string,
  opts: { competitorId?: string } = {}
): Promise<CompetitorMomentum[]> {
  let competitorQuery = supabase.from("competitors").select("id, name").eq("account_id", accountId);
  if (opts.competitorId) competitorQuery = competitorQuery.eq("id", opts.competitorId);
  const { data: competitors } = await competitorQuery;
  const list = competitors ?? [];
  if (list.length === 0) return [];
  const competitorIds = list.map((c) => c.id);

  const lookbackStart = new Date();
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - 180);

  const [{ data: signals }, { data: winLoss }, { data: stateHistory }] = await Promise.all([
    supabase
      .from("signals")
      .select("competitor_id, type, sentiment, occurred_on, scored, relevance_score")
      .in("competitor_id", competitorIds)
      .gte("occurred_on", lookbackStart.toISOString().slice(0, 10)),
    supabase.from("competitor_win_loss").select("competitor_id, outcome, created_at").in("competitor_id", competitorIds),
    supabase
      .from("competitor_state_history")
      .select("competitor_id, metric, value, recorded_at")
      .in("competitor_id", competitorIds)
      .gte("recorded_at", lookbackStart.toISOString()),
  ]);

  return list.map((c) => ({
    competitor: c,
    momentum: computeMomentum(
      (signals ?? []).filter((s) => s.competitor_id === c.id),
      (winLoss ?? []).filter((e) => e.competitor_id === c.id),
      (stateHistory ?? []).filter((e) => e.competitor_id === c.id)
    ),
  }));
}
