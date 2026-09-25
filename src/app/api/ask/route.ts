import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askAccountQuestion } from "@/lib/ask";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ error: "Question is required." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();
  if (!profile?.account_id) {
    return NextResponse.json({ error: "No account found." }, { status: 400 });
  }

  try {
    const answer = await askAccountQuestion(supabase, profile.account_id, question);
    return NextResponse.json({ answer });
  } catch (err) {
    console.error("ask failed:", err);
    return NextResponse.json({ error: "Couldn't get an answer just now; try again in a moment." }, { status: 502 });
  }
}
