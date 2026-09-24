import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Manual single-response entry — log one NPS score from the account's own
// customer, same "one at a time" shape as logging a single win/loss deal.
// RLS scopes the insert to the caller's own account.
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
  const score = Number(body?.score);
  if (!Number.isInteger(score) || score < 0 || score > 10) {
    return NextResponse.json({ error: "Score must be a whole number from 0 to 10." }, { status: 400 });
  }
  const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : null;
  const respondent = typeof body?.respondent === "string" && body.respondent.trim() ? body.respondent.trim() : null;
  const surveyDate =
    typeof body?.surveyDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.surveyDate)
      ? body.surveyDate
      : new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("account_nps_responses")
    .insert({
      account_id: profile.account_id,
      score,
      reason,
      respondent,
      survey_date: surveyDate,
      source: "manual",
      created_by: user.id,
    })
    .select("id, score, reason, respondent, survey_date, source, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ response: data });
}
