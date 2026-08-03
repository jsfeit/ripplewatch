import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runCrawlForAccount } from "@/lib/crawl";

// Manual single-account trigger for support/testing use — runs the exact
// same checks as the scheduled crawl cron, just scoped to one account
// instead of looping every account in the database. Lets support seed real
// signals for a test/demo account without waiting for the schedule or
// touching any other customer's data or Slack channel.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = createAdminClient();
  const { data: account, error } = await supabase.from("accounts").select("*").eq("id", id).single();

  if (error || !account) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const summary = await runCrawlForAccount(supabase, account);
  return NextResponse.json({ ok: true, summary });
}
