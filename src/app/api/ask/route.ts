import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askAccountQuestion } from "@/lib/ask";
import { meteredForConnect } from "@/lib/connect-metering";

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

  // A Ripplewatch Connect account prepays for answers: refused below a minimum
  // balance, otherwise charged what it cost plus the markup. Everyone else
  // asks for free, as before.
  const { data: account } = await supabase.from("accounts").select("tier").eq("id", profile.account_id).single();

  try {
    const run = await meteredForConnect(
      { accountId: profile.account_id, tier: account?.tier, toolName: "ask", schedule: (fn) => after(fn) },
      () => askAccountQuestion(supabase, profile.account_id!, question)
    );
    if (!run.ok) return NextResponse.json({ error: run.message }, { status: 402 });
    return NextResponse.json({ answer: run.value, usage: run.usage });
  } catch (err) {
    console.error("ask failed:", err);
    return NextResponse.json({ error: "Couldn't get an answer just now; try again in a moment." }, { status: 502 });
  }
}
