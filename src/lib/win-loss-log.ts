import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ExtractedWinLossEntry } from "@/lib/anthropic";
import { applyExtractedWinLossEntries } from "@/lib/win-loss-import";
import { loadCompetitorMomentum } from "@/lib/momentum-account";

type Admin = SupabaseClient<Database>;

export type LogWinLossResult =
  | {
      ok: true;
      matched: boolean;
      imported: number;
      skipped: number;
      suggestedCompetitors: string[];
      momentum: { score: number | null; label: string } | null;
    }
  | { ok: false; status: number; error: string };

// Structured single-deal logging shared by POST /api/v1/win-loss and the MCP
// log_win_loss tool. Deliberately skips the LLM extraction step the CSV and
// HubSpot imports use — a caller here already knows the competitor name and
// outcome, so there's nothing to infer from unstructured text. Matching is
// exact (case-insensitive) against the account's tracked competitor names,
// same as extractWinLossEntries' own "tracked" rule (no fuzzy matching there
// either); a name that doesn't match becomes a suggested competitor via the
// same shared apply logic the CSV import uses, rather than silently
// rejected.
export async function logWinLoss(
  supabase: Admin,
  accountId: string,
  input: { competitorName: string; outcome: "won" | "lost"; reason: string | null }
): Promise<LogWinLossResult> {
  const { data: competitors } = await supabase.from("competitors").select("id, name").eq("account_id", accountId);

  if (!competitors || competitors.length === 0) {
    return { ok: false, status: 400, error: "Add a competitor before submitting win/loss data." };
  }

  const tracked = competitors.find((c) => c.name.toLowerCase() === input.competitorName.toLowerCase());

  const entry: ExtractedWinLossEntry = tracked
    ? { matchType: "tracked", competitor: tracked.name, outcome: input.outcome, reason: input.reason }
    : { matchType: "untracked", competitor: input.competitorName, outcome: input.outcome, reason: input.reason };

  const result = await applyExtractedWinLossEntries(supabase, accountId, null, competitors, [entry]);

  // Immediate payoff: a tracked competitor's win/loss trend is now one of the
  // Momentum components, so a caller pushing data through here can see the
  // shift land in the same response instead of having to reload the
  // dashboard to find out it mattered.
  let momentum: { score: number | null; label: string } | null = null;
  if (tracked) {
    const [computed] = await loadCompetitorMomentum(supabase, accountId, { competitorId: tracked.id });
    if (computed) momentum = { score: computed.momentum.score, label: computed.momentum.label };
  }

  return {
    ok: true,
    matched: Boolean(tracked),
    imported: result.imported,
    skipped: result.skipped,
    suggestedCompetitors: result.suggestedCompetitors,
    momentum,
  };
}
