import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapWithConcurrency } from "@/lib/crawl";
import { buildMonthlyRecap } from "@/lib/connect-monthly-recap";
import { sendConnectMonthlyRecapEmail } from "@/lib/resend";
import { sendSlackMonthlyRecap } from "@/lib/slack";
import { connectDelivery } from "@/lib/connect-delivery";
import { loadSlackCredentials } from "@/lib/connect-slack";
import { accountUnsubscribeUrl } from "@/lib/unsubscribe-token";
import type { Database } from "@/lib/supabase/types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];

// Runs on the 1st of each month. Emails each Ripplewatch Connect account its
// last 30 days: how many changes were picked up and how many mattered, who is
// heating up, deal results, and the one thing that would sharpen the next
// month. Built from the account's own data with no model call.
//
// Slack is where the team sees it: with Slack connected the recap posts to the
// channel, and email goes only to accounts without Slack or ones that asked for
// both.
//
// Skipped for: accounts with the recap off, accounts under three weeks old
// (their onboarding emails cover that stretch), a month already sent (so a
// re-run can't double-send), and a month with nothing to report.
const ACCOUNT_CONCURRENCY = 5;
const MIN_ACCOUNT_AGE_DAYS = 21;

const monthKey = (iso: string) => iso.slice(0, 7);

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const supabase = createAdminClient();
  const now = new Date();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("tier", "connect")
    .eq("status", "active")
    .not("contact_email", "is", null);

  const summary = await mapWithConcurrency(accounts ?? [], ACCOUNT_CONCURRENCY, async (account: Account) => {
    if (!account.contact_email) return null;
    if (account.connect_monthly_recap_enabled === false) return { account: account.name, sent: false, reason: "off" };
    if (account.connect_monthly_recap_sent_at && monthKey(account.connect_monthly_recap_sent_at) === monthKey(now.toISOString())) {
      return { account: account.name, sent: false, reason: "already sent this month" };
    }
    if (now.getTime() - new Date(account.created_at).getTime() < MIN_ACCOUNT_AGE_DAYS * 86_400_000) {
      return { account: account.name, sent: false, reason: "too new" };
    }
    try {
      const recap = await buildMonthlyRecap(supabase, account.id, account.name);
      if (!recap) return { account: account.name, sent: false, reason: "nothing to report" };
      const slack = await loadSlackCredentials(supabase, account.id);
      const delivery = connectDelivery(account, Boolean(slack));
      const sent: string[] = [];
      if (delivery.slack && slack) {
        try {
          await sendSlackMonthlyRecap(slack as Parameters<typeof sendSlackMonthlyRecap>[0], {
            accountName: account.name,
            summary: recap.summary,
            competitors: recap.competitors,
            topSignals: recap.topSignals,
            nextStep: recap.nextStep,
            openUrl: `${appUrl}/app/settings?tab=connect`,
          });
          sent.push("slack");
        } catch (err) {
          console.error(`connect monthly recap Slack post failed for ${account.name}:`, err);
        }
      }
      // Email also covers a Slack post that failed, so the recap isn't lost.
      if (delivery.email || sent.length === 0) {
        await sendConnectMonthlyRecapEmail(account.contact_email, appUrl, accountUnsubscribeUrl(appUrl, account.id, "monthly"), recap);
        sent.push("email");
      }
      await supabase.from("accounts").update({ connect_monthly_recap_sent_at: now.toISOString() }).eq("id", account.id);
      return { account: account.name, sent: true, via: sent };
    } catch (err) {
      console.error(`connect monthly recap failed for ${account.name}:`, err);
      return { account: account.name, sent: false, reason: "error" };
    }
  });

  return NextResponse.json({ ok: true, summary: summary.filter(Boolean) });
}
