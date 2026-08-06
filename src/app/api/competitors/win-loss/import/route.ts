import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractWinLossEntries } from "@/lib/anthropic";

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
  const rawText = typeof body?.text === "string" ? body.text : "";
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

  const extracted = await extractWinLossEntries(
    competitors.map((c) => c.name),
    rawText,
    profile.account_id
  );

  if (extracted.length === 0) {
    return NextResponse.json({ imported: 0, skipped: 0 });
  }

  const competitorByName = new Map(competitors.map((c) => [c.name, c.id]));
  const matched = extracted
    .map((e) => ({ competitor_id: competitorByName.get(e.competitor), outcome: e.outcome, reason: e.reason }))
    .filter((e): e is { competitor_id: string; outcome: "won" | "lost"; reason: string } => Boolean(e.competitor_id));

  // Cheap dedup guard for re-imports of the same file: skip anything that
  // already exists verbatim for that competitor rather than duplicating it.
  const { data: existing } = await supabase
    .from("competitor_win_loss")
    .select("competitor_id, reason")
    .in(
      "competitor_id",
      [...new Set(matched.map((m) => m.competitor_id))]
    );
  const existingSet = new Set((existing ?? []).map((e) => `${e.competitor_id}::${e.reason}`));
  const toInsert = matched.filter((m) => !existingSet.has(`${m.competitor_id}::${m.reason}`));

  if (toInsert.length > 0) {
    const { error } = await supabase
      .from("competitor_win_loss")
      .insert(toInsert.map((m) => ({ ...m, created_by: user.id })));
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    imported: toInsert.length,
    skipped: extracted.length - toInsert.length,
  });
}
