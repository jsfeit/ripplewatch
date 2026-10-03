import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { importWinLossText } from "@/lib/win-loss-import-text";

// A 1,500-row real-world test took several minutes with no maxDuration set
// (Vercel's default is far shorter) — bigger batches per call and more
// concurrency cuts the number of round trips substantially, and this stops
// a genuinely large file from getting killed mid-run instead of just
// returning a slow-but-honest result.
export const maxDuration = 300;

const MAX_CHUNKS = 100; // bounds cost on a pathologically large paste (~3,000 rows)

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

  const imported = await importWinLossText(supabase, profile.account_id, user.id, rawText, MAX_CHUNKS);
  if (!imported.ok) return NextResponse.json({ error: imported.error }, { status: imported.status });
  return NextResponse.json(imported.result);
}
