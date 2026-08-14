import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Churn isn't competitor-scoped the way a sales deal is — a customer who
// cancels rarely names one specific competitor they switched to, so unlike
// competitor_win_loss this rolls straight into the account-wide churn_notes
// blob, mirroring the general-reason append pattern win-loss-import.ts
// already uses for lost_deal_notes/won_deal_notes.
const CHURN_NOTES_MAX_CHARS = 6000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json({ error: "A reason is required." }, { status: 400 });
  }

  const { data: profile } = await supabase.from("profiles").select("account_id").eq("id", user.id).single();
  if (!profile?.account_id) {
    return NextResponse.json({ error: "No account." }, { status: 400 });
  }
  const accountId = profile.account_id;

  const { data: account } = await supabase.from("accounts").select("churn_notes").eq("id", accountId).single();
  const existingNotes = account?.churn_notes ?? "";
  let combined = existingNotes ? `${existingNotes} ${reason}.` : `${reason}.`;
  if (combined.length > CHURN_NOTES_MAX_CHARS) {
    combined = combined.slice(combined.length - CHURN_NOTES_MAX_CHARS);
  }

  const { error } = await supabase.from("accounts").update({ churn_notes: combined }).eq("id", accountId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ churnNotes: combined });
}
