import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { extractWinLossEntries } from "@/lib/anthropic";
import { applyExtractedWinLossEntries } from "@/lib/win-loss-import";
import { importDealText, loadDealCoverage, type DealImportSummary } from "@/lib/deal-ingest";
import { mapWithConcurrency } from "@/lib/crawl";
import { chunkCsv } from "@/lib/csv-chunk";
import { parseDealTable } from "@/lib/deal-csv";

// Free text (a pasted paragraph or list with no columns) is still read line by line, since there is no
// table to map. CHUNK_ROWS stays well under what one response can hold.
export const CHUNK_ROWS = 30;
export const CHUNK_CONCURRENCY = 8;

export type ImportWinLossTextResult =
  | { ok: true; result: DealImportSummary }
  | { ok: false; status: number; error: string };

// A real table: a header with several columns and rows that mostly have as many cells.
function looksTabular(text: string): boolean {
  const table = parseDealTable(text);
  if (table.header.length < 3 || table.rows.length < 1) return false;
  const wide = table.rows.filter((r) => r.length >= Math.min(3, table.header.length)).length;
  return wide / table.rows.length >= 0.8;
}

// The shared body of the CSV-import route and the MCP import_win_loss tool. A table in any column
// layout goes through column mapping, per-reason reading and an idempotent write (deal-ingest.ts); it
// works with no tracked competitors yet and keeps each deal's own close date. Anything that is not a
// table falls back to line-by-line reading.
export async function importWinLossText(
  supabase: SupabaseClient<Database>,
  accountId: string,
  userId: string | null,
  rawText: string,
  maxChunks: number,
  source = "csv"
): Promise<ImportWinLossTextResult> {
  if (looksTabular(rawText)) return importDealText(supabase, accountId, userId, rawText, { source });

  const { data: competitors } = await supabase.from("competitors").select("id, name").eq("account_id", accountId);
  const tracked = competitors ?? [];
  const chunks = chunkCsv(rawText, CHUNK_ROWS, maxChunks);
  const chunkResults = await mapWithConcurrency(chunks, CHUNK_CONCURRENCY, (chunk) =>
    extractWinLossEntries(
      tracked.map((c) => c.name),
      chunk,
      accountId
    ).catch((err) => {
      console.error("win-loss import: chunk extraction failed", err);
      return [];
    })
  );
  const extracted = chunkResults.flat();
  const totalRows = rawText.split("\n").filter((l) => l.trim()).length;
  const rowsConsidered = Math.min(totalRows, chunks.length * CHUNK_ROWS);

  const applied = extracted.length
    ? await applyExtractedWinLossEntries(supabase, accountId, userId, tracked, extracted)
    : {
        totalExtracted: 0,
        imported: 0,
        skipped: 0,
        generalReasonsAdded: 0,
        generalReasonsSkipped: 0,
        generalWonReasonsAdded: 0,
        generalWonReasonsSkipped: 0,
        suggestedCompetitors: [],
        untrackedAlreadySuggested: 0,
      };

  return {
    ok: true,
    result: {
      ...applied,
      rowsConsidered,
      totalRows,
      truncated: rowsConsidered < totalRows,
      updated: 0,
      datedPct: 0,
      coverage: await loadDealCoverage(supabase, accountId),
      importId: null,
    },
  };
}
