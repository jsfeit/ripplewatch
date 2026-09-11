import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueCrawlForAccount } from "@/lib/crawl";

// Manual single-account trigger for support/testing use — queues the exact
// same per-competitor jobs the scheduled crawl cron does, just scoped to
// one account instead of every account in the database. Enqueueing is
// pure DB writes, so this returns almost immediately; the actual checks
// run shortly after via /api/cron/crawl-worker, same as any other crawl.
// This used to run every competitor's checks synchronously and return the
// result in one response — moved to the same queue as the cron because
// that shape had no ceiling protecting it from Vercel's 300s timeout: an
// account with enough competitors, or a few bot-protected domains, could
// (and did) time out the whole request with nothing saved as "in
// progress." See migration 0065 for the full reasoning.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = createAdminClient();
  const { data: account, error } = await supabase.from("accounts").select("*").eq("id", id).single();

  if (error || !account) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const summary = await enqueueCrawlForAccount(supabase, account);
  return NextResponse.json({ ok: true, summary });
}
