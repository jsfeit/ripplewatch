import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logCustomerFeedback } from "@/lib/feedback-log";

// Manual single-entry logging — one piece of customer feedback at a time,
// same shape as logging a single win/loss deal. Validation and the insert
// live in logCustomerFeedback, shared with the MCP tool. RLS scopes the
// insert to the caller's own account.
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
  const result = await logCustomerFeedback(supabase, profile.account_id, user.id, {
    summary: body?.summary,
    score: body?.score,
    respondent: body?.respondent,
    source: body?.source,
    feedbackDate: body?.feedbackDate,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ entry: result.entry });
}
