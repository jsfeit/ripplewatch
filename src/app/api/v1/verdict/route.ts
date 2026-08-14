import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiRequest } from "@/lib/api-auth";

// Same 8-day staleness rule as the News dashboard banner (see
// dashboard/page.tsx) — if the weekly cron ever misses a run, this returns
// null rather than an agent reading week-old context as current.
const VERDICT_STALE_MS = 8 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const supabase = createAdminClient();
  const { data: account } = await supabase
    .from("accounts")
    .select("weekly_verdict, weekly_verdict_generated_at")
    .eq("id", auth.accountId)
    .single();

  const isFresh =
    account?.weekly_verdict &&
    account.weekly_verdict_generated_at &&
    Date.now() - new Date(account.weekly_verdict_generated_at).getTime() < VERDICT_STALE_MS;

  return NextResponse.json({
    data: {
      verdict: isFresh ? account!.weekly_verdict : null,
      generated_at: isFresh ? account!.weekly_verdict_generated_at : null,
    },
  });
}
