import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Manual single-entry logging — one piece of customer feedback at a time,
// same shape as logging a single win/loss deal. score is optional: present
// for an NPS-style entry, omitted for a plain ask/feature-request. RLS
// scopes the insert to the caller's own account.
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
  const summary = typeof body?.summary === "string" ? body.summary.trim() : "";
  if (!summary) {
    return NextResponse.json({ error: "Enter what the customer said." }, { status: 400 });
  }

  let score: number | null = null;
  if (body?.score !== undefined && body?.score !== null && body?.score !== "") {
    const parsed = Number(body.score);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10) {
      return NextResponse.json({ error: "Score must be a whole number from 0 to 10." }, { status: 400 });
    }
    score = parsed;
  }

  const respondent = typeof body?.respondent === "string" && body.respondent.trim() ? body.respondent.trim() : null;
  const source = typeof body?.source === "string" && body.source.trim() ? body.source.trim() : null;
  const feedbackDate =
    typeof body?.feedbackDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.feedbackDate)
      ? body.feedbackDate
      : new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("account_customer_feedback")
    .insert({
      account_id: profile.account_id,
      summary,
      score,
      respondent,
      source,
      feedback_date: feedbackDate,
      status: "new",
      origin: "manual",
      created_by: user.id,
    })
    .select("id, summary, score, respondent, source, status, feedback_date, origin, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entry: data });
}
