import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadFirstLook } from "@/lib/first-look";
import { buildOnboardingEmail, type OnboardingStage } from "@/lib/connect-onboarding-email";
import { sendConnectOnboardingEmail } from "@/lib/resend";
import { accountUnsubscribeUrl } from "@/lib/unsubscribe-token";
import { mapWithConcurrency } from "@/lib/crawl";

const DAY_MS = 24 * 60 * 60 * 1000;
const ACCOUNT_CONCURRENCY = 5;

// Daily. Sends each active Connect account at most one day-2 email (once it's
// 2 to 6 days old) and one day-7 email (7 to 13 days old). The windows have an
// upper bound so a late deploy never sends a stale "day 2" email to someone
// who signed up a month ago. What each email says depends on where that
// account actually is; see buildOnboardingEmail.
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const supabase = createAdminClient();

  const { data: accounts } = await supabase
    .from("accounts")
    .select(
      "id, name, created_at, contact_email, mcp_last_connected_at, onboarding_email_day2_sent_at, onboarding_email_day7_sent_at"
    )
    .eq("tier", "connect")
    .eq("status", "active")
    .is("onboarding_emails_unsubscribed_at", null)
    .not("contact_email", "is", null)
    .gte("created_at", new Date(Date.now() - 14 * DAY_MS).toISOString());

  const summary = await mapWithConcurrency(accounts ?? [], ACCOUNT_CONCURRENCY, async (account) => {
    if (!account.contact_email) return null;
    const ageDays = (Date.now() - new Date(account.created_at).getTime()) / DAY_MS;
    const stage: OnboardingStage | null =
      ageDays >= 2 && ageDays < 7 && !account.onboarding_email_day2_sent_at
        ? "day2"
        : ageDays >= 7 && ageDays < 14 && !account.onboarding_email_day7_sent_at
          ? "day7"
          : null;
    if (!stage) return null;

    try {
      const look = await loadFirstLook(supabase, account.id);
      const email = buildOnboardingEmail({
        stage,
        companyName: account.name,
        connected: Boolean(account.mcp_last_connected_at),
        look,
      });
      await sendConnectOnboardingEmail(account.contact_email, appUrl, accountUnsubscribeUrl(appUrl, account.id), email);
      await supabase
        .from("accounts")
        .update(stage === "day2" ? { onboarding_email_day2_sent_at: new Date().toISOString() } : { onboarding_email_day7_sent_at: new Date().toISOString() })
        .eq("id", account.id);
      return { account: account.name, stage, sent: true };
    } catch (err) {
      console.error(`connect onboarding email failed for ${account.name}:`, err);
      return { account: account.name, stage, sent: false };
    }
  });

  return NextResponse.json({ ok: true, summary: summary.filter(Boolean) });
}
