import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateWeeklyAccountIntelligence } from "@/lib/digest";
import { hasMinimumBalance } from "@/lib/connect-wallet";
import { sendConnectWeeklyEmail } from "@/lib/resend";
import { mapWithConcurrency } from "@/lib/crawl";
import type { Database } from "@/lib/supabase/types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];

// Runs once a week for Ripplewatch Connect accounts, which the dashboard digest
// jobs deliberately skip (their emails link to a dashboard Connect doesn't
// have). Regenerates the account's weekly verdict, which the assistant's
// briefing tool also reads, and emails it: the verdict and a balance line, no
// usage breakdown.
//
// The verdict's LLM cost is recorded against the account like everything else,
// so the daily usage charge bills it at cost plus markup. An account with no
// balance to run on is skipped (it's paused), and a quiet week with nothing
// worth a verdict sends nothing.
const ACCOUNT_CONCURRENCY = 5;

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

  const summary = await mapWithConcurrency(accounts ?? [], ACCOUNT_CONCURRENCY, async (account: Account) => {
    if (!account.contact_email) return null;
    try {
      const funds = await hasMinimumBalance(supabase, account.id);
      if (!funds.ok) return { account: account.name, sent: false, reason: "paused" };

      const { data: competitors } = await supabase
        .from("competitors")
        .select("id, name, created_at")
        .eq("account_id", account.id);
      if (!competitors || competitors.length === 0) return { account: account.name, sent: false, reason: "no competitors" };

      const { verdict } = await generateWeeklyAccountIntelligence(supabase, account, competitors);
      if (!verdict) return { account: account.name, sent: false, reason: "quiet week" };

      await sendConnectWeeklyEmail(account.contact_email, account.name, verdict, funds.balanceUsd, appUrl);
      return { account: account.name, sent: true };
    } catch (err) {
      console.error(`connect weekly failed for ${account.name}:`, err);
      return { account: account.name, sent: false, reason: "error" };
    }
  });

  return NextResponse.json({ ok: true, summary: summary.filter(Boolean) });
}
