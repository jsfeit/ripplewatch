import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractWinLossEntries } from "@/lib/anthropic";
import { applyExtractedWinLossEntries } from "@/lib/win-loss-import";

// A 1,500-row real-world test took several minutes with no maxDuration set
// (Vercel's default is far shorter) — bigger batches per call and more
// concurrency cuts the number of round trips substantially, and this stops
// a genuinely large file from getting killed mid-run instead of just
// returning a slow-but-honest result.
export const maxDuration = 300;

// extractWinLossEntries caps itself at WIN_LOSS_EXTRACT_LINE_LIMIT lines per
// call to keep a single call cheap — a real CRM export can easily be
// 1,000+ rows, so the route chunks the file itself (header repeated on each
// chunk for column context) rather than silently only ever looking at the
// first N rows.
//
// CHUNK_ROWS was 150 until real testing showed the model now extracts an
// entry for nearly every row (per the anti-refusal prompt fix) — at 150
// rows/call the response routinely blew past max_tokens and got cut off
// mid-JSON, failing every single chunk. A failed real response measured
// ~9,300 characters for just 18 entries before truncating at max_tokens
// 4096 (~2.3 chars/token for this JSON shape) — at max_tokens 8192 (see
// extractWinLossEntries), a near-1:1 row-to-entry chunk needs to stay
// well under ~35-40 entries to have real margin.
const CHUNK_ROWS = 30;
const MAX_CHUNKS = 100; // bounds cost on a pathologically large paste (~3,000 rows)
const CHUNK_CONCURRENCY = 8;

function chunkCsv(rawText: string): string[] {
  const lines = rawText.split("\n").filter((l) => l.trim());
  if (lines.length <= 1) return [rawText];
  const [header, ...rows] = lines;
  const chunks: string[] = [];
  for (let i = 0; i < rows.length && chunks.length < MAX_CHUNKS; i += CHUNK_ROWS) {
    chunks.push([header, ...rows.slice(i, i + CHUNK_ROWS)].join("\n"));
  }
  return chunks;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

// Accepts whatever raw text a customer pastes/uploads (CSV, any column
// layout, plain list) — see extractWinLossEntries for why this doesn't try
// to parse columns itself. Account-wide rather than per-competitor since a
// single CSV export can span every competitor at once.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("account_id").eq("id", user.id).single();
  if (!profile?.account_id) {
    return NextResponse.json({ error: "No account." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const rawText: string = typeof body?.text === "string" ? body.text : "";
  if (!rawText.trim()) {
    return NextResponse.json({ error: "No data to import." }, { status: 400 });
  }

  const { data: competitors } = await supabase
    .from("competitors")
    .select("id, name")
    .eq("account_id", profile.account_id);
  if (!competitors || competitors.length === 0) {
    return NextResponse.json({ error: "Add a competitor before importing win/loss data." }, { status: 400 });
  }

  const chunks = chunkCsv(rawText);
  const competitorNames = competitors.map((c) => c.name);
  const chunkResults = await mapWithConcurrency(chunks, CHUNK_CONCURRENCY, (chunk) =>
    extractWinLossEntries(competitorNames, chunk, profile.account_id).catch((err) => {
      console.error("win-loss import: chunk extraction failed", err);
      return [];
    })
  );
  const extracted = chunkResults.flat();
  console.log(`win-loss import: ${chunks.length} chunks, ${extracted.length} entries extracted`);

  const totalRows = rawText.split("\n").filter((l) => l.trim()).length - 1;
  const rowsConsidered = Math.min(totalRows, chunks.length * CHUNK_ROWS);
  const truncated = rowsConsidered < totalRows;

  if (extracted.length === 0) {
    return NextResponse.json({
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
    });
  }

  const result = await applyExtractedWinLossEntries(supabase, profile.account_id, user.id, competitors, extracted);

  return NextResponse.json({ ...result, rowsConsidered, totalRows, truncated });
}
