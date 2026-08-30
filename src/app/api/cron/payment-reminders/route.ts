import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaymentReminderEmail } from "@/lib/resend";

const DAY_MS = 24 * 60 * 60 * 1000;
const STEP_1_AFTER_MS = DAY_MS; // 24h after signup, still unpaid
const STEP_2_AFTER_MS = 4 * DAY_MS; // 4 days after signup, still unpaid

// Runs once a day. Every tier requires payment — there's no free plan — but
// the account is fully created and usable before the Stripe redirect even
// happens, so abandoning checkout today leaves a customer with permanent
// free access and no follow-up. This closes that gap with two nudges, then
// stops; accounts that complete a subscription drop out of the query
// entirely (stripe_subscription_id is no longer null).
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, contact_email, created_at, payment_reminder_1_sent_at, payment_reminder_2_sent_at")
    .is("stripe_subscription_id", null)
    .eq("status", "active");

  const now = Date.now();
  const summary: Record<string, unknown>[] = [];

  for (const account of accounts ?? []) {
    if (!account.contact_email) continue;
    const ageMs = now - new Date(account.created_at).getTime();

    let step: 1 | 2 | null = null;
    if (!account.payment_reminder_2_sent_at && account.payment_reminder_1_sent_at && ageMs >= STEP_2_AFTER_MS) {
      step = 2;
    } else if (!account.payment_reminder_1_sent_at && ageMs >= STEP_1_AFTER_MS) {
      step = 1;
    }

    if (!step) continue;

    try {
      await sendPaymentReminderEmail(account.contact_email, account.name, step, appUrl);
    } catch (err) {
      console.error(`payment reminder step ${step} failed for ${account.name}:`, err);
      summary.push({ account: account.name, step, sent: false });
      continue;
    }

    const sentAt = new Date().toISOString();
    await supabase
      .from("accounts")
      .update(step === 1 ? { payment_reminder_1_sent_at: sentAt } : { payment_reminder_2_sent_at: sentAt })
      .eq("id", account.id);

    summary.push({ account: account.name, step, sent: true });
  }

  return NextResponse.json({ ok: true, summary });
}
