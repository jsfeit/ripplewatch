import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ExtractedWinLossEntry } from "@/lib/anthropic";
import { applyExtractedWinLossEntries } from "@/lib/win-loss-import";
import { loadCompetitorMomentum } from "@/lib/momentum-account";
import { classifyDealReasons } from "@/lib/deal-llm";
import { createHash } from "node:crypto";

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
  input: {
    // Blank when the deal never named who won (most losses): it is still logged, as a dated, themed
    // outcome with no competitor.
    competitorName: string;
    outcome: "won" | "lost";
    reason: string | null;
    // The deal's own close date (YYYY-MM-DD). Omit and it counts as closing today.
    closedOn?: string | null;
    amount?: number | null;
    dealName?: string | null;
    source?: string;
  }
): Promise<LogWinLossResult> {
  const { data: competitors } = await supabase.from("competitors").select("id, name").eq("account_id", accountId);
  const list = competitors ?? [];
  const name = input.competitorName.trim();
  const tracked = name ? list.find((c) => c.name.toLowerCase() === name.toLowerCase()) : undefined;
  const closedOn = input.closedOn && /^\d{4}-\d{2}-\d{2}$/.test(input.closedOn) ? input.closedOn : new Date().toISOString().slice(0, 10);

  if (!name && !input.reason) {
    return { ok: false, status: 400, error: "Name the competitor or give a reason, so there is something to record." };
  }

  let suggestedCompetitors: string[] = [];
  if (name && !tracked) {
    // Not tracked yet: becomes a suggestion on the Competitors page, same as an import.
    const entry: ExtractedWinLossEntry = { matchType: "untracked", competitor: name, outcome: input.outcome, reason: input.reason };
    const applied = await applyExtractedWinLossEntries(supabase, accountId, null, list, [entry]);
    suggestedCompetitors = applied.suggestedCompetitors;
  }

  // Tracked competitor, or no competitor named: a real dated deal row. The same deal logged twice
  // (same competitor, outcome, reason and date) is recorded once.
  let imported = 0;
  let skipped = 0;
  if (tracked || !name) {
    const dealRef =
      "m:" + createHash("sha1").update([tracked?.id ?? "", input.outcome, input.reason ?? "", closedOn].join("\u0001")).digest("hex").slice(0, 20);
    const { data: existing } = await supabase
      .from("competitor_win_loss")
      .select("id")
      .eq("account_id", accountId)
      .eq("deal_ref", dealRef)
      .maybeSingle();
    if (existing) {
      skipped = 1;
    } else {
      let themes: string[] = [];
      let detail: string | null = null;
      if (input.reason) {
        try {
          const [read] = await classifyDealReasons(list.map((c) => c.name), [{ key: "1", outcome: input.outcome, competitor: tracked?.name ?? null, reason: input.reason }], accountId);
          themes = read?.themes ?? [];
          detail = read?.detail ?? null;
        } catch (err) {
          console.error("logWinLoss: could not read the reason, saving without themes", err);
        }
      }
      const { error } = await supabase.from("competitor_win_loss").insert({
        account_id: accountId,
        competitor_id: tracked?.id ?? null,
        outcome: input.outcome,
        reason: input.reason,
        closed_on: closedOn,
        amount: input.amount ?? null,
        deal_name: input.dealName ?? null,
        deal_ref: dealRef,
        source: input.source ?? "manual",
        reason_themes: themes,
        reason_detail: detail,
        competitor_raw: name || null,
      });
      if (!error) imported = 1;
    }
  }

  // Immediate payoff: a tracked competitor's win/loss trend is now one of the
  // Momentum components, so a caller pushing data through here can see the
  // shift land in the same response instead of having to reload the
  // dashboard to find out it mattered.
  let momentum: { score: number | null; label: string } | null = null;
  if (tracked) {
    const [computed] = await loadCompetitorMomentum(supabase, accountId, { competitorId: tracked.id });
    if (computed) momentum = { score: computed.momentum.score, label: computed.momentum.label };
  }

  return { ok: true, matched: Boolean(tracked), imported, skipped, suggestedCompetitors, momentum };
}
