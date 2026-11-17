import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { loadCompetitorMomentum } from "@/lib/momentum-account";

type Admin = SupabaseClient<Database>;

export type MomentumBoardRow = { name: string; label: string; score: number | null; confidence: string };

// Every tracked competitor's Momentum, the biggest movers first. Returned alongside anything that
// changes what Ripplewatch knows (new deals, new churn numbers), so the assistant can open with where
// competitors stand now rather than only confirming the save.
export async function loadMomentumBoard(supabase: Admin, accountId: string, limit = 8): Promise<MomentumBoardRow[]> {
  const all = await loadCompetitorMomentum(supabase, accountId);
  return all
    .map(({ competitor, momentum: m }) => ({ name: competitor.name, label: m.label, score: m.score, confidence: m.confidence }))
    .sort((a, b) => Math.abs(b.score ?? 0) - Math.abs(a.score ?? 0))
    .slice(0, limit);
}
