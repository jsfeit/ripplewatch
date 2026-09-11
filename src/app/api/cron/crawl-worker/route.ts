import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processCrawlJobBatch, finalizeCompletedRuns } from "@/lib/crawl";

// Same budget as the old full-crawl cron, but for a very different reason:
// that one needed 300s because it did everything for every account in one
// request. This one gets the same ceiling purely as headroom — a single
// batch of ~24 competitor-crawls plus finalizing up to 20 completed runs
// should finish in a small fraction of it, every tick.
export const maxDuration = 300;

// Runs every couple minutes (see vercel.json) — claims and processes one
// bounded batch of pending crawl_jobs (see /api/cron/crawl for how those
// get created), then scores any account whose crawl_run just finished.
// However many jobs or accounts exist, this shape doesn't change: there's
// just more ticks, never one invocation whose duration scales with total
// competitor/account count. See migration 0065 for the full reasoning.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const batch = await processCrawlJobBatch(supabase);
  const finalized = await finalizeCompletedRuns(supabase);

  return NextResponse.json({ ok: true, batch, finalized });
}
