import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { extractWinLossEntries } from "@/lib/anthropic";
import { applyExtractedWinLossEntries, type ApplyResult } from "@/lib/win-loss-import";
import { mapWithConcurrency } from "@/lib/crawl";
import { chunkCsv } from "@/lib/csv-chunk";

// extractWinLossEntries caps itself per call, so raw text is chunked here (with
// the header repeated for column context). CHUNK_ROWS stays well under what a
// single response can hold: the model now extracts an entry for nearly every
// row, and 150 rows/call used to blow past max_tokens and fail every chunk.
export const CHUNK_ROWS = 30;
export const CHUNK_CONCURRENCY = 8;

export type ImportWinLossTextResult =
  | { ok: true; result: ApplyResult & { rowsConsidered: number; totalRows: number; truncated: boolean } }
  | { ok: false; status: number; error: string };

// The shared body of the CSV-import route and the MCP import_win_loss tool:
// raw deal text in (any column layout), classified per row, written through
// the same apply step everything else uses.
export async function importWinLossText(
  supabase: SupabaseClient<Database>,
  accountId: string,
  userId: string | null,
  rawText: string,
  maxChunks: number
): Promise<ImportWinLossTextResult> {
  const { data: competitors } = await supabase.from("competitors").select("id, name").eq("account_id", accountId);
  if (!competitors || competitors.length === 0) {
    return { ok: false, status: 400, error: "Add a competitor before importing win/loss data." };
  }

  const chunks = chunkCsv(rawText, CHUNK_ROWS, maxChunks);
  const competitorNames = competitors.map((c) => c.name);
  const chunkResults = await mapWithConcurrency(chunks, CHUNK_CONCURRENCY, (chunk) =>
    extractWinLossEntries(competitorNames, chunk, accountId).catch((err) => {
      console.error("win-loss import: chunk extraction failed", err);
      return [];
    })
  );
  const extracted = chunkResults.flat();

  const totalRows = rawText.split("\n").filter((l) => l.trim()).length - 1;
  const rowsConsidered = Math.min(totalRows, chunks.length * CHUNK_ROWS);
  const truncated = rowsConsidered < totalRows;

  if (extracted.length === 0) {
    return {
      ok: true,
      result: {
        totalExtracted: 0,
        imported: 0,
        skipped: 0,
        generalReasonsAdded: 0,
        generalReasonsSkipped: 0,
        generalWonReasonsAdded: 0,
        generalWonReasonsSkipped: 0,
        suggestedCompetitors: [],
        untrackedAlreadySuggested: 0,
        rowsConsidered,
        totalRows,
        truncated,
      },
    };
  }

  const result = await applyExtractedWinLossEntries(supabase, accountId, userId, competitors, extracted);
  return { ok: true, result: { ...result, rowsConsidered, totalRows, truncated } };
}
