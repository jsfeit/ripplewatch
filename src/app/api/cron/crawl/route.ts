import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueCrawlForAccount, mapWithConcurrency, type EnqueueSummary } from "@/lib/crawl";
import type { Database } from "@/lib/supabase/types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];

// Enqueueing is just a couple of DB writes per account, not the external
// fetches/LLM calls the old shape did — 60s is generous headroom, not a
// budget this is expected to approach.
export const maxDuration = 60;

// This used to run every account's entire crawl (every competitor, every
// signal source) inside this one request, bounded by Vercel's 300s
// timeout — a ceiling that scaled with total competitor/account count
// across the whole customer base, not something concurrency tuning
// removes. Now it only enqueues one crawl_jobs row per competitor per
// active account; /api/cron/crawl-worker (a much more frequent, short
// cron) does the actual work in small, isolated batches afterward. See
// migration 0065 for the full reasoning.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: allAccounts } = await supabase.from("accounts").select("*").eq("status", "active");

  // Ripplewatch Connect accounts prepay for monitoring: one with nothing left
  // in its balance isn't crawled until it adds funds (the daily usage charge
  // runs just before this, so an account that just ran out is skipped today).
  const connectIds = (allAccounts ?? []).filter((a) => a.tier === "connect").map((a) => a.id);
  const funded = new Set<string>();
  if (connectIds.length > 0) {
    const { data: wallets } = await supabase
      .from("connect_wallets")
      .select("account_id, balance_micros")
      .in("account_id", connectIds)
      .gt("balance_micros", 0);
    for (const w of wallets ?? []) funded.add(w.account_id);
  }
  const accounts = (allAccounts ?? []).filter((a) => a.tier !== "connect" || funded.has(a.id));

  const summary = await mapWithConcurrency(accounts ?? [], 10, async (account: Account): Promise<EnqueueSummary> => {
    try {
      return await enqueueCrawlForAccount(supabase, account);
    } catch (err) {
      console.error(`failed to enqueue crawl for account ${account.name} (${account.id}):`, err);
      return { account: account.name, queued: 0 };
    }
  });

  return NextResponse.json({ ok: true, summary });
}
