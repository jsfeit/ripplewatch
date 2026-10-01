import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Marks the get-started flow done without requiring any of the optional
// context (positioning, competitors, Slack) — called when someone connects
// their assistant and clicks past the rest instead of filling it in. See
// /app/get-started/page.tsx: this is what stops it redirecting them back.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("account_id").eq("id", user.id).single();
  if (!profile?.account_id) return NextResponse.json({ error: "No account yet." }, { status: 400 });

  const { error } = await supabase
    .from("accounts")
    .update({ connect_get_started_dismissed_at: new Date().toISOString() })
    .eq("id", profile.account_id);
  if (error) return NextResponse.json({ error: "Could not save that." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
