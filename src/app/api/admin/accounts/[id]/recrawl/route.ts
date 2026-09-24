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

// Polled by the admin "Recrawl now" button while a run it just queued is
// still in flight — the button used to re-enable the instant POST above
// returned (which only confirms the jobs were CREATED, not run), so
// clicking again a few seconds later queued a second full batch on top of
// the first, over and over, with no visible sign anything was actually
// happening in between. This answers "is runId done yet" so the client can
// keep the button disabled and show real progress until every job in that
// run has either completed or errored.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const runId = new URL(request.url).searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "runId is required." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: run, error: runError } = await supabase
    .from("crawl_runs")
    .select("id, total_jobs")
    .eq("id", runId)
    .eq("account_id", id)
    .maybeSingle();
  if (runError || !run) {
    return NextResponse.json({ error: "Crawl run not found." }, { status: 404 });
  }

  const { data: jobs, error: jobsError } = await supabase
    .from("crawl_jobs")
    .select("status")
    .eq("run_id", runId);
  if (jobsError) {
    return NextResponse.json({ error: jobsError.message }, { status: 500 });
  }

  const done = (jobs ?? []).filter((j) => j.status === "done").length;
  const errored = (jobs ?? []).filter((j) => j.status === "error").length;
  const finished = done + errored >= run.total_jobs;

  return NextResponse.json({ total: run.total_jobs, done, error: errored, finished });
}
