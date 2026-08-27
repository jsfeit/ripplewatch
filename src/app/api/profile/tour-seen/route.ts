import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Called once the guided product tour starts (not on completion, so
// clicking away mid-tour still counts as "seen" and it won't re-fire on
// the next visit — same one-shot intent as any other dismissible nudge).
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { error } = await supabase.from("profiles").update({ has_seen_product_tour: true }).eq("id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
