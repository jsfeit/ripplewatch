import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseFeedbackCsv, parsePlainFeedbackList, type ParsedFeedbackRow } from "@/lib/customer-voice";
import { extractCustomerFeedback } from "@/lib/anthropic";
import { chunkCsv } from "@/lib/csv-chunk";
import { mapWithConcurrency } from "@/lib/crawl";

// Bounds one file to a sane size.
const MAX_ROWS = 5000;
const CHUNK_ROWS = 50;
const MAX_CHUNKS = 60; // bounds LLM cost on a pathologically large paste
const CHUNK_CONCURRENCY = 8;

// Below this fraction of data rows successfully parsed, treat the fast
// column-matched attempt as having failed rather than silently importing a
// thin, likely-wrong subset — a matched column that's actually something
// else (a 1-5 rating, a free-text field mismatched as the score column)
// would otherwise "succeed" at parsing almost nothing and still report as
// done. Escalating to LLM extraction instead gives a real shot at the file.
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

  const structured = parseFeedbackCsv(rawText);
  const plainList = structured.rows.length === 0 ? parsePlainFeedbackList(rawText) : [];

  let rows: ParsedFeedbackRow[];
  let usedExtraction = false;
  if (structured.rows.length > 0 && structured.rows.length >= structured.totalDataRows * MIN_PARSE_RATE) {
    rows = structured.rows;
  } else if (plainList.length > 0) {
    rows = plainList;
  } else if (structured.totalDataRows === 0 && plainList.length === 0) {
    return NextResponse.json({ error: "No data rows found in that file." }, { status: 400 });
  } else {
    // No recognizable column, or the matched columns mostly didn't hold
    // real data — read the raw file with an LLM instead of a rigid column
    // match. Chunked the same way win-loss's freeform import is, since a
    // real export can be hundreds of rows.
    usedExtraction = true;
    const chunks = chunkCsv(rawText, CHUNK_ROWS, MAX_CHUNKS);
    const chunkResults = await mapWithConcurrency(chunks, CHUNK_CONCURRENCY, (chunk) =>
      extractCustomerFeedback(chunk, accountId).catch((err) => {
        console.error("customer-feedback import: chunk extraction failed", err);
        return [];
      })
    );
    rows = chunkResults.flat().map((e) => ({
      summary: e.summary,
      score: e.score,
      feedback_date: e.date ?? new Date().toISOString().slice(0, 10),
      respondent: e.respondent,
      source: e.source,
    }));
  }

  if (rows.length === 0) {
    return NextResponse.json({
      error: "Couldn't find any real feedback in that file, even after a closer read.",
    }, { status: 400 });
  }

  const capped = rows.slice(0, MAX_ROWS);
  const { error } = await supabase.from("account_customer_feedback").insert(
    capped.map((r) => ({
      account_id: accountId,
      summary: r.summary,
      score: r.score,
      respondent: r.respondent,
      source: r.source,
      feedback_date: r.feedback_date,
      status: "new" as const,
      origin: "csv_import" as const,
      created_by: user.id,
    }))
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    imported: capped.length,
    skipped: structured.skipped + Math.max(0, rows.length - capped.length),
    usedExtraction,
  });
}
