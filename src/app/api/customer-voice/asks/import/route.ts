import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseAsksCsv, type ParsedAskRow } from "@/lib/customer-voice";
import { extractCustomerAsks } from "@/lib/anthropic";
import { chunkCsv } from "@/lib/csv-chunk";
import { mapWithConcurrency } from "@/lib/crawl";

const MAX_ROWS = 2000;
const CHUNK_ROWS = 40;
const MAX_CHUNKS = 60;
const CHUNK_CONCURRENCY = 8;

// Generous headroom for the LLM-extraction fallback path on a large file.
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

  // parseAsksCsv only returns rows for a recognized header or a genuinely
  // plain (no-comma) list — anything else (a real export with no column
  // this codebase's fixed header list recognizes) comes back empty here
  // and falls through to LLM extraction below, same fallback role as the
  // NPS import route.
  let rows: ParsedAskRow[] = parseAsksCsv(rawText);
  let usedExtraction = false;
  if (rows.length === 0) {
    usedExtraction = true;
    const chunks = chunkCsv(rawText, CHUNK_ROWS, MAX_CHUNKS);
    const chunkResults = await mapWithConcurrency(chunks, CHUNK_CONCURRENCY, (chunk) =>
      extractCustomerAsks(chunk, accountId).catch((err) => {
        console.error("customer-asks import: chunk extraction failed", err);
        return [];
      })
    );
    rows = chunkResults.flat();
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "Nothing to import — check the file has at least one real ask in it." }, { status: 400 });
  }

  const capped = rows.slice(0, MAX_ROWS);
  const { error } = await supabase.from("account_customer_asks").insert(
    capped.map((r) => ({
      account_id: accountId,
      summary: r.summary,
      source: r.source ?? "csv_import",
      status: "new" as const,
      created_by: user.id,
    }))
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ imported: capped.length, skipped: Math.max(0, rows.length - capped.length), usedExtraction });
}
