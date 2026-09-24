import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseNpsCsv, type ParsedNpsRow } from "@/lib/customer-voice";
import { extractNpsResponses } from "@/lib/anthropic";
import { chunkCsv } from "@/lib/csv-chunk";
import { mapWithConcurrency } from "@/lib/crawl";

// Bounds one file to a sane size — NPS exports are one row per response,
// so even a very active account's full history rarely approaches this.
const MAX_ROWS = 5000;

// Same shape as the win-loss import route's own chunking, scaled down —
// NPS rows are much smaller per-row (no long freeform reason text
// required) than a win-loss CSV, so a bigger chunk still comfortably fits
// the extraction call's max_tokens.
const CHUNK_ROWS = 60;
const MAX_CHUNKS = 60; // bounds LLM cost on a pathologically large paste
const CHUNK_CONCURRENCY = 8;

// Below this fraction of data rows successfully parsed, treat the fast
// column-matched attempt as having failed rather than silently importing
// a thin, likely-wrong subset — a matched column that's actually a 1-5
// rating or free text would otherwise "succeed" at parsing almost nothing
// and still report as done. Escalating to LLM extraction instead gives a
// real shot at the file instead of a quiet partial import.
const MIN_PARSE_RATE = 0.3;

// Generous headroom for the LLM-extraction fallback path on a large file —
// the fast structured path never needs anywhere near this.
export const maxDuration = 300;

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
  const accountId = profile.account_id;

  const body = await request.json().catch(() => null);
  const rawText: string = typeof body?.text === "string" ? body.text : "";
  if (!rawText.trim()) {
    return NextResponse.json({ error: "No data to import." }, { status: 400 });
  }

  const structured = parseNpsCsv(rawText);
  if (structured.totalDataRows === 0) {
    return NextResponse.json({ error: "No data rows found in that file." }, { status: 400 });
  }

  let rows: ParsedNpsRow[];
  let usedExtraction = false;
  if (structured.rows.length >= structured.totalDataRows * MIN_PARSE_RATE) {
    rows = structured.rows;
  } else {
    // No recognizable column, or the matched column mostly didn't hold
    // real 0-10 scores — read the raw file with an LLM instead of a rigid
    // column match. Chunked the same way win-loss's freeform import is,
    // since a real export can be hundreds of rows.
    usedExtraction = true;
    const chunks = chunkCsv(rawText, CHUNK_ROWS, MAX_CHUNKS);
    const chunkResults = await mapWithConcurrency(chunks, CHUNK_CONCURRENCY, (chunk) =>
      extractNpsResponses(chunk, accountId).catch((err) => {
        console.error("nps import: chunk extraction failed", err);
        return [];
      })
    );
    rows = chunkResults.flat().map((e) => ({
      score: e.score,
      survey_date: e.date ?? new Date().toISOString().slice(0, 10),
      reason: e.reason,
      respondent: e.respondent,
    }));
  }

  if (rows.length === 0) {
    return NextResponse.json({
      error: "Couldn't find any real 0-10 scores in that file, even after a closer read. Check it's an NPS export, not a different rating scale.",
    }, { status: 400 });
  }

  const capped = rows.slice(0, MAX_ROWS);
  const { error } = await supabase.from("account_nps_responses").insert(
    capped.map((r) => ({
      account_id: accountId,
      score: r.score,
      reason: r.reason,
      respondent: r.respondent,
      survey_date: r.survey_date,
      source: "csv_import" as const,
      created_by: user.id,
    }))
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    imported: capped.length,
    skipped: Math.max(0, rows.length - capped.length),
    totalDataRows: structured.totalDataRows,
    usedExtraction,
  });
}
