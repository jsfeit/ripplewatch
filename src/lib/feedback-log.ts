import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export type LoggedFeedback = {
  id: string;
  summary: string;
  score: number | null;
  respondent: string | null;
  source: string | null;
  status: string;
  feedback_date: string;
  origin: string;
  created_at: string;
};

export type LogFeedbackResult = { ok: true; entry: LoggedFeedback } | { ok: false; status: number; error: string };

// One piece of customer feedback, validated and inserted. Shared by the
// Customer voice form's route (RLS-scoped client, createdBy = the signed-in
// user) and the MCP log_customer_feedback tool (service-role client, no
// signed-in profile behind an API key, so createdBy is null). score is
// optional: present for an NPS-style entry, omitted for a plain
// ask/feature-request.
export async function logCustomerFeedback(
  supabase: Client,
  accountId: string,
  createdBy: string | null,
  input: {
    summary: unknown;
    score?: unknown;
    respondent?: unknown;
    source?: unknown;
    feedbackDate?: unknown;
  }
): Promise<LogFeedbackResult> {
  const summary = typeof input.summary === "string" ? input.summary.trim() : "";
  if (!summary) return { ok: false, status: 400, error: "Enter what the customer said." };

  let score: number | null = null;
  if (input.score !== undefined && input.score !== null && input.score !== "") {
    const parsed = Number(input.score);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10) {
      return { ok: false, status: 400, error: "Score must be a whole number from 0 to 10." };
    }
    score = parsed;
  }

  const respondent = typeof input.respondent === "string" && input.respondent.trim() ? input.respondent.trim() : null;
  const source = typeof input.source === "string" && input.source.trim() ? input.source.trim() : null;
  const feedbackDate =
    typeof input.feedbackDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.feedbackDate)
      ? input.feedbackDate
      : new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("account_customer_feedback")
    .insert({
      account_id: accountId,
      summary,
      score,
      respondent,
      source,
      feedback_date: feedbackDate,
      status: "new",
      origin: "manual",
      created_by: createdBy,
    })
    .select("id, summary, score, respondent, source, status, feedback_date, origin, created_at")
    .single();

  if (error) return { ok: false, status: 500, error: error.message };
  return { ok: true, entry: data };
}
