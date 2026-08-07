import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ExtractedWinLossEntry } from "@/lib/anthropic";

// Caps unbounded growth from repeated imports — this mirrors the same
// free-text field onboarding fills in once and scoring already reads, not
// a new structured store, so it needs a ceiling rather than growing
// forever across every re-import.
const LOST_DEAL_NOTES_MAX_CHARS = 6000;
const MAX_NEW_SUGGESTIONS_PER_IMPORT = 10;

export type ApplyResult = {
  totalExtracted: number;
  imported: number;
  skipped: number;
  generalReasonsAdded: number;
  generalReasonsSkipped: number;
  suggestedCompetitors: string[];
  untrackedAlreadySuggested: number;
};

// Shared by both the CSV-import and HubSpot-sync routes: takes whatever
// extractWinLossEntries classified and actually persists it —
// - "tracked" entries insert into competitor_win_loss (deduped against
//   what's already there).
// - "untracked" entries become suggested_competitors rows (capped, ranked
//   by how often they came up) so a competitor the account is actually
//   losing/winning against, but isn't tracking yet, surfaces as a
//   suggestion instead of vanishing.
// - "general" lost entries (no identifiable competitor, but a real reason)
//   roll into the account's lost_deal_notes free text, the same field
//   scoring already reads — general "won" entries have no equivalent field
//   to land in today, so they're not persisted beyond the response counts.
//
// Every bucket tracks its own "already had this" count, not just tracked —
// re-running the same file (or one that overlaps a prior import) should
// read as "found N, all already known" rather than "found nothing," which
// looks identical to a genuinely empty/irrelevant file otherwise.
export async function applyExtractedWinLossEntries(
  supabase: SupabaseClient<Database>,
  accountId: string,
  userId: string,
  competitors: { id: string; name: string }[],
  entries: ExtractedWinLossEntry[]
): Promise<ApplyResult> {
  const competitorByName = new Map(competitors.map((c) => [c.name, c.id]));

  const tracked = entries.filter(
    (e): e is Extract<ExtractedWinLossEntry, { matchType: "tracked" }> => e.matchType === "tracked"
  );
  const untracked = entries.filter(
    (e): e is Extract<ExtractedWinLossEntry, { matchType: "untracked" }> => e.matchType === "untracked"
  );
  const general = entries.filter(
    (e): e is Extract<ExtractedWinLossEntry, { matchType: "general" }> =>
      e.matchType === "general" && e.outcome === "lost"
  );

  // --- Tracked: insert into competitor_win_loss, deduped ---
  const matched = tracked
    .map((e) => ({ competitor_id: competitorByName.get(e.competitor), outcome: e.outcome, reason: e.reason }))
    .filter((e): e is { competitor_id: string; outcome: "won" | "lost"; reason: string | null } =>
      Boolean(e.competitor_id)
    );

  let imported = 0;
  let skipped = 0;
  if (matched.length > 0) {
    const { data: existing } = await supabase
      .from("competitor_win_loss")
      .select("competitor_id, reason")
      .in("competitor_id", [...new Set(matched.map((m) => m.competitor_id))]);
    const existingSet = new Set((existing ?? []).map((e) => `${e.competitor_id}::${e.reason ?? ""}`));
    const toInsert = matched.filter((m) => !existingSet.has(`${m.competitor_id}::${m.reason ?? ""}`));
    skipped = matched.length - toInsert.length;

    if (toInsert.length > 0) {
      const { error } = await supabase
        .from("competitor_win_loss")
        .insert(toInsert.map((m) => ({ ...m, created_by: userId })));
      if (!error) imported = toInsert.length;
    }
  }

  // --- Untracked: surface as suggested competitors, most-mentioned first ---
  const suggestedCompetitors: string[] = [];
  let untrackedAlreadySuggested = 0;
  if (untracked.length > 0) {
    const counts = new Map<string, { name: string; won: number; lost: number }>();
    for (const e of untracked) {
      const key = e.competitor.toLowerCase();
      const entry = counts.get(key) ?? { name: e.competitor, won: 0, lost: 0 };
      if (e.outcome === "won") entry.won++;
      else entry.lost++;
      counts.set(key, entry);
    }

    const { data: existingSuggestions } = await supabase
      .from("suggested_competitors")
      .select("name")
      .eq("account_id", accountId);
    const existingNames = new Set((existingSuggestions ?? []).map((s) => s.name.toLowerCase()));

    const allDistinct = [...counts.values()];
    untrackedAlreadySuggested = allDistinct.filter((c) => existingNames.has(c.name.toLowerCase())).length;

    const candidates = allDistinct
      .filter((c) => !existingNames.has(c.name.toLowerCase()))
      .sort((a, b) => b.won + b.lost - (a.won + a.lost))
      .slice(0, MAX_NEW_SUGGESTIONS_PER_IMPORT);

    for (const c of candidates) {
      const parts = [];
      if (c.lost > 0) parts.push(`${c.lost} lost deal${c.lost === 1 ? "" : "s"}`);
      if (c.won > 0) parts.push(`${c.won} won deal${c.won === 1 ? "" : "s"}`);
      const { error } = await supabase.from("suggested_competitors").insert({
        account_id: accountId,
        name: c.name,
        reasoning: `Named in imported win/loss data (${parts.join(", ")}) — not currently tracked.`,
        status: "pending",
      });
      // A unique (account_id, lower(name)) index means a race with another
      // import/the discovery cron just no-ops here rather than erroring.
      if (!error) suggestedCompetitors.push(c.name);
    }
  }

  // --- General lost reasons: roll into the account's lost_deal_notes ---
  let generalReasonsAdded = 0;
  let generalReasonsSkipped = 0;
  if (general.length > 0) {
    const { data: account } = await supabase.from("accounts").select("lost_deal_notes").eq("id", accountId).single();
    const existingNotes = account?.lost_deal_notes ?? "";
    const distinctReasons = [...new Set(general.map((e) => e.reason.trim()))];
    const newReasons = distinctReasons.filter((r) => !existingNotes.includes(r));
    generalReasonsSkipped = distinctReasons.length - newReasons.length;

    if (newReasons.length > 0) {
      let combined = existingNotes ? `${existingNotes} ${newReasons.join(". ")}.` : `${newReasons.join(". ")}.`;
      if (combined.length > LOST_DEAL_NOTES_MAX_CHARS) {
        combined = combined.slice(combined.length - LOST_DEAL_NOTES_MAX_CHARS);
      }
      const { error } = await supabase.from("accounts").update({ lost_deal_notes: combined }).eq("id", accountId);
      if (!error) generalReasonsAdded = newReasons.length;
    }
  }

  return {
    totalExtracted: entries.length,
    imported,
    skipped,
    generalReasonsAdded,
    generalReasonsSkipped,
    suggestedCompetitors,
    untrackedAlreadySuggested,
  };
}
