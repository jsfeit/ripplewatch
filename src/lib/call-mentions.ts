import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { recordStateHistory } from "@/lib/scraping";
import { loadCompetitorMomentum } from "@/lib/momentum-account";

type Admin = SupabaseClient<Database>;

const MAX_QUOTE_CHARS = 500;
const WINDOW_DAYS = 30;

export type CallMentionInput = {
  competitorName: string;
  quote: string;
  occurredOn?: string | null;
};

export type LogCallMentionsResult =
  | {
      ok: true;
      imported: number;
      alreadyLogged: number;
      unmatchedCompetitors: string[];
      momentum: { competitor: string; label: string; score: number | null }[];
    }
  | { ok: false; error: string };

function validDate(value: string | null | undefined): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return today;
  // Never in the future, and not older than the window momentum looks at.
  return value > today ? today : value;
}

// Records competitor mentions the customer's assistant read in their own call
// tool. Matching is exact (case-insensitive) on tracked competitor names, the
// same rule as logWinLoss; a name that doesn't match is reported back, not
// guessed at. After inserting, writes the trailing-30-day count per touched
// competitor to competitor_state_history, which is what momentum already
// reads as the call-mention input.
export async function logCallMentions(
  supabase: Admin,
  accountId: string,
  mentions: CallMentionInput[]
): Promise<LogCallMentionsResult> {
  const { data: competitors } = await supabase.from("competitors").select("id, name").eq("account_id", accountId);
  if (!competitors || competitors.length === 0) {
    return { ok: false, error: "Add a competitor before logging call mentions." };
  }
  const byName = new Map(competitors.map((c) => [c.name.toLowerCase(), c]));

  const rows: Database["public"]["Tables"]["call_mentions"]["Insert"][] = [];
  const unmatched = new Set<string>();
  for (const m of mentions) {
    const competitor = byName.get(m.competitorName.trim().toLowerCase());
    const quote = m.quote.trim().slice(0, MAX_QUOTE_CHARS);
    if (!quote) continue;
    if (!competitor) {
      unmatched.add(m.competitorName.trim());
      continue;
    }
    const occurredOn = validDate(m.occurredOn);
    rows.push({
      account_id: accountId,
      competitor_id: competitor.id,
      quote,
      occurred_on: occurredOn,
      source: "assistant",
      dedupe_key: createHash("sha256").update(`${competitor.id}|${occurredOn}|${quote.toLowerCase()}`).digest("hex").slice(0, 32),
    });
  }

  let imported = 0;
  if (rows.length > 0) {
    const { data, error } = await supabase
      .from("call_mentions")
      .upsert(rows, { onConflict: "account_id,dedupe_key", ignoreDuplicates: true })
      .select("id");
    if (error) return { ok: false, error: "Could not save those mentions." };
    imported = data?.length ?? 0;
  }

  const touched = [...new Set(rows.map((r) => r.competitor_id))];
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - WINDOW_DAYS);
  for (const competitorId of touched) {
    const { count } = await supabase
      .from("call_mentions")
      .select("id", { count: "exact", head: true })
      .eq("competitor_id", competitorId)
      .gte("occurred_on", since.toISOString().slice(0, 10));
    await recordStateHistory(supabase, competitorId, "call_mention_count", count ?? 0);
  }

  const momentum = touched.length
    ? (await loadCompetitorMomentum(supabase, accountId))
        .filter((m) => touched.includes(m.competitor.id))
        .map((m) => ({ competitor: m.competitor.name, label: m.momentum.label, score: m.momentum.score }))
    : [];

  return { ok: true, imported, alreadyLogged: rows.length - imported, unmatchedCompetitors: [...unmatched], momentum };
}
