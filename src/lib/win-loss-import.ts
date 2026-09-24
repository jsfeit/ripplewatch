import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ExtractedWinLossEntry } from "@/lib/anthropic";

// Caps unbounded growth from repeated imports — this mirrors the same
// free-text field onboarding fills in once and scoring already reads, not
// a new structured store, so it needs a ceiling rather than growing
// forever across every re-import.
const DEAL_NOTES_MAX_CHARS = 6000;
const MAX_NEW_SUGGESTIONS_PER_IMPORT = 10;

export type ApplyResult = {
  totalExtracted: number;
  imported: number;
  skipped: number;
  generalReasonsAdded: number;
  generalReasonsSkipped: number;
  generalWonReasonsAdded: number;
  generalWonReasonsSkipped: number;
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
// - "general" entries (no identifiable competitor, but a real reason) now
//   insert into competitor_win_loss too, with competitor_id null (see
//   0061_win_loss_unattributed_and_churn) so they get a real date and can
//   feed the unattributed-attrition correlation in churn-correlation.ts —
//   AND still roll into the account's lost_deal_notes/won_deal_notes text
//   blob, since scoring prompts (crawl.ts, generateFactSheet) read that as
//   narrative context, not aggregate stats, and this keeps that path
//   working unchanged.
//
// Every bucket tracks its own "already had this" count, not just tracked —
// re-running the same file (or one that overlaps a prior import) should
// read as "found N, all already known" rather than "found nothing," which
// looks identical to a genuinely empty/irrelevant file otherwise.
export async function applyExtractedWinLossEntries(
  supabase: SupabaseClient<Database>,
  accountId: string,
  // Null for entries submitted via the public API or inbound email — there's
  // no signed-in profile behind an API key or a forwarded email, and
  // created_by is nullable (on delete set null) precisely so this has
  // somewhere valid to point.
  userId: string | null,
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
  const generalLost = entries.filter(
    (e): e is Extract<ExtractedWinLossEntry, { matchType: "general" }> =>
      e.matchType === "general" && e.outcome === "lost"
  );
  const generalWon = entries.filter(
    (e): e is Extract<ExtractedWinLossEntry, { matchType: "general" }> =>
      e.matchType === "general" && e.outcome === "won"
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
        .insert(toInsert.map((m) => ({ ...m, account_id: accountId, created_by: userId })));
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
        reasoning: `Named in imported win/loss data (${parts.join(", ")}), not currently tracked.`,
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
  if (generalLost.length > 0) {
    const { data: account } = await supabase.from("accounts").select("lost_deal_notes").eq("id", accountId).single();
    const existingNotes = account?.lost_deal_notes ?? "";
    const distinctReasons = [...new Set(generalLost.map((e) => e.reason.trim()))];
    const newReasons = distinctReasons.filter((r) => !existingNotes.includes(r));
    generalReasonsSkipped = distinctReasons.length - newReasons.length;

    if (newReasons.length > 0) {
      let combined = existingNotes ? `${existingNotes} ${newReasons.join(". ")}.` : `${newReasons.join(". ")}.`;
      if (combined.length > DEAL_NOTES_MAX_CHARS) {
        combined = combined.slice(combined.length - DEAL_NOTES_MAX_CHARS);
      }
      const { error } = await supabase.from("accounts").update({ lost_deal_notes: combined }).eq("id", accountId);
      if (!error) {
        generalReasonsAdded = newReasons.length;
        await supabase.from("competitor_win_loss").insert(
          newReasons.map((reason) => ({
            account_id: accountId,
            competitor_id: null,
            outcome: "lost" as const,
            reason,
            created_by: userId,
          }))
        );
      }
    }
  }

  // --- General won reasons: roll into the account's won_deal_notes ---
  // Mirrors the lost-reason handling above exactly, just the other outcome
  // and field — these have no per-competitor home (no competitor named), so
  // every fact sheet reads them as general, not-tied-to-this-competitor
  // supporting evidence for whyWeWin (see generateFactSheet).
  let generalWonReasonsAdded = 0;
  let generalWonReasonsSkipped = 0;
  if (generalWon.length > 0) {
    const { data: account } = await supabase.from("accounts").select("won_deal_notes").eq("id", accountId).single();
    const existingNotes = account?.won_deal_notes ?? "";
    const distinctReasons = [...new Set(generalWon.map((e) => e.reason.trim()))];
    const newReasons = distinctReasons.filter((r) => !existingNotes.includes(r));
    generalWonReasonsSkipped = distinctReasons.length - newReasons.length;

    if (newReasons.length > 0) {
      let combined = existingNotes ? `${existingNotes} ${newReasons.join(". ")}.` : `${newReasons.join(". ")}.`;
      if (combined.length > DEAL_NOTES_MAX_CHARS) {
        combined = combined.slice(combined.length - DEAL_NOTES_MAX_CHARS);
      }
      const { error } = await supabase.from("accounts").update({ won_deal_notes: combined }).eq("id", accountId);
      if (!error) {
        generalWonReasonsAdded = newReasons.length;
        await supabase.from("competitor_win_loss").insert(
          newReasons.map((reason) => ({
            account_id: accountId,
            competitor_id: null,
            outcome: "won" as const,
            reason,
            created_by: userId,
          }))
        );
      }
    }
  }

  return {
    totalExtracted: entries.length,
    imported,
    skipped,
    generalReasonsAdded,
    generalReasonsSkipped,
    generalWonReasonsAdded,
    generalWonReasonsSkipped,
    suggestedCompetitors,
    untrackedAlreadySuggested,
  };
}

// The CSV-import route adds a few fields on top of ApplyResult (how much
// of the file it actually read) that the HubSpot-sync route has no
// equivalent for — optional here for exactly that reason.
export type ImportMessageData = ApplyResult & {
  rowsConsidered?: number;
  totalRows?: number;
  truncated?: boolean;
};

// Shared by the two client surfaces that show an import result
// (CompetitorFactSheet's per-competitor import, and the Win/loss page's
// all-competitors import) — was hand-duplicated verbatim in both
// (win-loss-page-client.tsx and competitor-fact-sheet.tsx) apart from one
// wording difference, which perCompetitor now parameterizes instead: a
// single competitor's page reasonably calls an unattributed reason
// "general" (general to that competitor's page), but the all-competitors
// page needs "unattributed" instead, since "general" there would misread
// as general to the whole account rather than not tied to any one
// competitor.
export function formatWinLossImportMessage(source: string, data: ImportMessageData, perCompetitor: boolean): string {
  const generalWord = perCompetitor ? "general" : "unattributed";
  const rowsPart =
    data.rowsConsidered !== undefined ? `read ${data.rowsConsidered} row${data.rowsConsidered === 1 ? "" : "s"}, ` : "";
  const parts = [`${source}: ${rowsPart}found ${data.totalExtracted} relevant ${data.totalExtracted === 1 ? "entry" : "entries"}`];

  const generalSkippedNote = data.generalReasonsSkipped > 0 ? `, ${data.generalReasonsSkipped} already known` : "";
  const generalWonSkippedNote = data.generalWonReasonsSkipped > 0 ? `, ${data.generalWonReasonsSkipped} already known` : "";
  const untrackedSkippedNote = data.untrackedAlreadySuggested > 0 ? `, ${data.untrackedAlreadySuggested} already suggested` : "";

  parts.push(`imported ${data.imported} win/loss ${data.imported === 1 ? "entry" : "entries"}${data.skipped > 0 ? ` (${data.skipped} already logged)` : ""}.`);
  if (data.generalReasonsAdded > 0 || data.generalReasonsSkipped > 0) {
    parts.push(`Added ${data.generalReasonsAdded} ${generalWord} lost-deal reason${data.generalReasonsAdded === 1 ? "" : "s"}${perCompetitor ? " to account context" : ""}${generalSkippedNote}.`);
  }
  if (data.generalWonReasonsAdded > 0 || data.generalWonReasonsSkipped > 0) {
    parts.push(`Added ${data.generalWonReasonsAdded} ${generalWord} win reason${data.generalWonReasonsAdded === 1 ? "" : "s"}${perCompetitor ? " to account context" : ""}${generalWonSkippedNote}.`);
  }
  if (data.suggestedCompetitors.length > 0 || data.untrackedAlreadySuggested > 0) {
    const suggestedPart =
      data.suggestedCompetitors.length > 0
        ? `suggested ${data.suggestedCompetitors.length} untracked competitor${data.suggestedCompetitors.length === 1 ? "" : "s"} (${data.suggestedCompetitors.join(", ")})`
        : "no new competitors to suggest";
    parts.push(`${suggestedPart}${untrackedSkippedNote}. See the Competitors page.`);
  }
  if (data.totalExtracted === 0) {
    parts.push("(nothing in this file had enough signal to keep)");
  }
  if (data.truncated && data.rowsConsidered !== undefined && data.totalRows !== undefined) {
    parts.push(`Only processed the first ${data.rowsConsidered} of ${data.totalRows} rows.`);
  }
  return `${parts[0]}. ${parts.slice(1).join(" ")}`.trim();
}
