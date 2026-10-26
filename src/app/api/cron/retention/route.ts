import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendRetentionNoticeEmail } from "@/lib/resend";
import { RETENTION_DAYS, RETENTION_NOTICE_DAYS, deleteAccountData, retentionDeleteDate } from "@/lib/retention";

export const maxDuration = 300;

const DAY_MS = 24 * 60 * 60 * 1000;

// Runs once a day. Deletes the data of accounts that cancelled more than 30
// days ago, after emailing them a week before. Until RETENTION_DELETE_ENABLED is
// "true" it only reports what it would do (add ?dry=1 to force that even when
// enabled), so the first runs can be read before anything is removed.
//
// Only an account that is still cancelled with no subscription is touched, and
// never a demo account. One that still holds a prepaid balance is skipped and
// listed for a person to look at, since that money may be owed back.
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enabled = process.env.RETENTION_DELETE_ENABLED === "true" && new URL(request.url).searchParams.get("dry") !== "1";
  const admin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const now = Date.now();

  const { data: accounts, error } = await admin
    .from("accounts")
    .select("id, name, contact_email, canceled_at, retention_notice_sent_at")
    .eq("subscription_status", "canceled")
    .is("stripe_subscription_id", null)
    .eq("demo_mode", false)
    .not("canceled_at", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const report: { account: string; action: string; detail?: string }[] = [];

  for (const account of accounts ?? []) {
    const canceledAt = account.canceled_at as string;
    const ageMs = now - new Date(canceledAt).getTime();
    const deleteOn = retentionDeleteDate(canceledAt);

    if (ageMs >= RETENTION_DAYS * DAY_MS) {
      const { data: wallet } = await admin.from("connect_wallets").select("balance_micros").eq("account_id", account.id).maybeSingle();
      if ((wallet?.balance_micros ?? 0) > 0) {
        report.push({ account: account.name, action: "skipped", detail: "still has a prepaid balance, needs a person" });
        continue;
      }
      if (!enabled) {
        report.push({ account: account.name, action: "would delete", detail: `cancelled ${canceledAt}` });
        continue;
      }
      const result = await deleteAccountData(admin, account.id);
      report.push({ account: account.name, action: result.ok ? "deleted" : "failed", detail: result.ok ? undefined : result.error });
      continue;
    }

    const noticeDue = ageMs >= (RETENTION_DAYS - RETENTION_NOTICE_DAYS) * DAY_MS && !account.retention_notice_sent_at;
    if (!noticeDue || !account.contact_email) continue;
    if (!enabled) {
      report.push({ account: account.name, action: "would email notice", detail: `deletes ${deleteOn.toISOString().slice(0, 10)}` });
      continue;
    }
    try {
      await sendRetentionNoticeEmail(
        account.contact_email,
        account.name,
        deleteOn.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        appUrl
      );
      await admin.from("accounts").update({ retention_notice_sent_at: new Date().toISOString() }).eq("id", account.id);
      report.push({ account: account.name, action: "notice sent" });
    } catch (err) {
      report.push({ account: account.name, action: "notice failed", detail: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ enabled, retentionDays: RETENTION_DAYS, report });
}
