import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseNpsCsv } from "@/lib/customer-voice";

// Bounds one file to a sane size — NPS exports are one row per response,
// so even a very active account's full history rarely approaches this.
const MAX_ROWS = 5000;

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

  const { rows, totalDataRows, skipped } = parseNpsCsv(rawText);
  if (totalDataRows === 0) {
    return NextResponse.json({ error: "No data rows found in that file." }, { status: 400 });
  }
  if (rows.length === 0) {
    return NextResponse.json({
      error:
        "Couldn't find a recognizable score column (expects something like \"score\", \"nps\", or \"rating\"). Check the file's header row.",
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
    skipped: skipped + Math.max(0, rows.length - capped.length),
    totalDataRows,
  });
}
