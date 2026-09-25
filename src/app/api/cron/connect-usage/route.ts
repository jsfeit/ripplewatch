import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeDailyUsage, previousUtcDay } from "@/lib/connect-usage";
import { maybeAutoReload } from "@/lib/connect-billing";

// Runs once a day, before the crawl. For every active Ripplewatch Connect
// account: charge the previous UTC day's monitoring and background LLM usage
// to the prepaid wallet, then top the wallet up if that left it low. Runs
// before the crawl so an account that just hit zero is skipped by it.
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const day = previousUtcDay(new Date());
  const { data: accounts } = await supabase.from("accounts").select("id").eq("tier", "connect").eq("status", "active");

  const summary: { accountId: string; charged: boolean; chargeUsd: number }[] = [];
  for (const account of accounts ?? []) {
    try {
      const result = await chargeDailyUsage(supabase, account.id, day);
      summary.push({ accountId: account.id, charged: result.charged, chargeUsd: result.chargeUsd });
      await maybeAutoReload(supabase, account.id);
    } catch (err) {
      console.error(`connect daily usage failed for ${account.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, day: day.key, accounts: summary.length, summary });
}
