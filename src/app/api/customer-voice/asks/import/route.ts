import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseAsksCsv } from "@/lib/customer-voice";

const MAX_ROWS = 2000;

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

  const rows = parseAsksCsv(rawText);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Nothing to import — check the file has at least one non-empty line." }, { status: 400 });
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

  return NextResponse.json({ imported: capped.length, skipped: Math.max(0, rows.length - capped.length) });
}
