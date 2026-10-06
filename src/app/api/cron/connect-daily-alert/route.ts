import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapWithConcurrency } from "@/lib/crawl";
import { buildDailyAlertEmail } from "@/lib/connect-alerts";
import { sendConnectDailyAlertEmail } from "@/lib/resend";
import { accountUnsubscribeUrl } from "@/lib/unsubscribe-token";
import type { Database } from "@/lib/supabase/types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];

// Runs once a day, after the crawl. For each Ripplewatch Connect account with
// alerts on, sends one email listing the High-relevance changes that haven't
// been emailed yet, and nothing on a quiet day. The dashboard daily digest
// skips Connect accounts (its emails link to a dashboard they don't have), so
// this is their equivalent, narrower on purpose: High only.
//
// Only changes from the last 36 hours qualify, so the first run for an
// existing account can't dump its older history into one email. No model call:
// the relevance reasoning was written when each signal was scored.
const ACCOUNT_CONCURRENCY = 5;
const LOOKBACK_HOURS = 36;

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const supabase = createAdminClient();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("tier", "connect")
    .eq("status", "active")
    .not("contact_email", "is", null);

  const since = new Date(Date.now() - LOOKBACK_HOURS * 3_600_000).toISOString();

  const summary = await mapWithConcurrency(accounts ?? [], ACCOUNT_CONCURRENCY, async (account: Account) => {
    if (!account.contact_email) return null;
    // Undefined (column not migrated yet) counts as on, matching the default.
    if (account.connect_daily_alert_enabled === false) return { account: account.name, sent: 0, reason: "off" };
    try {
      const { data: competitors } = await supabase.from("competitors").select("id, name").eq("account_id", account.id);
      if (!competitors || competitors.length === 0) return { account: account.name, sent: 0, reason: "no competitors" };

      const { data: signals } = await supabase
        .from("signals")
        .select("id, competitor_id, title, relevance_reasoning, relevance_score")
        .in("competitor_id", competitors.map((c) => c.id))
        .eq("relevance_level", "High")
        .is("email_digest_sent_at", null)
        .neq("source", "backfill")
        .gte("created_at", since)
        .order("relevance_score", { ascending: false });
      const pending = signals ?? [];

      const email = buildDailyAlertEmail(
        account.name,
        pending.map((s) => ({
          competitor: competitors.find((c) => c.id === s.competitor_id)?.name ?? "A competitor",
          title: s.title,
          why: s.relevance_reasoning,
        }))
      );
      if (!email) return { account: account.name, sent: 0, reason: "quiet" };

      await sendConnectDailyAlertEmail(account.contact_email, appUrl, accountUnsubscribeUrl(appUrl, account.id, "daily"), email);
      await supabase
        .from("signals")
        .update({ email_digest_sent_at: new Date().toISOString() })
        .in("id", pending.map((s) => s.id));
      return { account: account.name, sent: pending.length };
    } catch (err) {
      // Left unmarked, so the next run retries within the 36-hour window.
      console.error(`connect daily alert failed for ${account.name}:`, err);
      return { account: account.name, sent: 0, reason: "error" };
    }
  });

  return NextResponse.json({ ok: true, summary: summary.filter(Boolean) });
}
