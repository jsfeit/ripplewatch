import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runCrawlForAccount, mapWithConcurrency, type CrawlSummary } from "@/lib/crawl";
import type { Database } from "@/lib/supabase/types";

export const maxDuration = 300; // Vercel Cron functions get a longer budget than normal requests

type Account = Database["public"]["Tables"]["accounts"]["Row"];

// Accounts run concurrently (bounded — see mapWithConcurrency), not one at a
// time: a plain sequential loop meant one slow account (a rate-limited API,
// a hung competitor fetch) could push every account after it in the list
// past this route's 300s budget without ever being crawled that day — no
// error, no partial-progress marker, just silently skipped. Kept modest
// since each account already runs its own competitors concurrently (see
// COMPETITOR_CONCURRENCY in crawl.ts) — this bounds total concurrent
// competitor-level work (fetches + LLM calls) across the whole cron run,
// not just per account.
const ACCOUNT_CONCURRENCY = 3;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: accounts } = await supabase.from("accounts").select("*");

  // Isolated per account: previously an uncaught throw from one account's
  // crawl (e.g. a Supabase error) would kill the whole for-loop, silently
  // skipping every account after it too — not just the one that failed.
  const summary = await mapWithConcurrency(accounts ?? [], ACCOUNT_CONCURRENCY, async (account: Account): Promise<CrawlSummary> => {
    try {
      return await runCrawlForAccount(supabase, account);
    } catch (err) {
      console.error(`crawl failed for account ${account.name} (${account.id}):`, err);
      return { account: account.name, newSignals: 0, scored: 0, error: err instanceof Error ? err.message : String(err) };
    }
  });

  return NextResponse.json({ ok: true, summary });
}
