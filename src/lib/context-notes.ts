import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { extractContextNote } from "@/lib/deal-llm";

type Admin = SupabaseClient<Database>;
export type ContextNoteRow = Database["public"]["Tables"]["context_notes"]["Row"];

const MAX_BODY = 4000;

// Stores a free-form note exactly as written and tags it (what kind, which product areas, which loss
// themes it speaks to, when it ships) so it can be lined up against lost-deal reasons and competitor
// moves. If tagging fails the note is still saved, untagged.
export async function addContextNote(
  supabase: Admin,
  accountId: string,
  userId: string | null,
  input: { body: string; effectiveOn?: string | null; source?: string }
): Promise<{ ok: true; note: ContextNoteRow } | { ok: false; error: string }> {
  const body = input.body.trim().slice(0, MAX_BODY);
  if (!body) return { ok: false, error: "The note is empty." };
  const today = new Date().toISOString().slice(0, 10);
  const effectiveOn = input.effectiveOn && /^\d{4}-\d{2}-\d{2}$/.test(input.effectiveOn) ? input.effectiveOn : today;

  const tags = await extractContextNote(body, today, accountId);
  const { data, error } = await supabase
    .from("context_notes")
    .insert({
      account_id: accountId,
      body,
      kind: tags.kind,
      status: tags.status,
      product_areas: tags.productAreas,
      themes: tags.themes,
      effective_on: effectiveOn,
      expected_on: tags.expectedOn,
      source: input.source ?? "manual",
      created_by: userId,
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: "Could not save that note." };
  return { ok: true, note: data };
}

export async function listContextNotes(supabase: Admin, accountId: string, limit = 50): Promise<ContextNoteRow[]> {
  const { data } = await supabase
    .from("context_notes")
    .select("*")
    .eq("account_id", accountId)
    .order("effective_on", { ascending: false })
    .limit(limit);
  return data ?? [];
}
