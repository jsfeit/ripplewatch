import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
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

  // Sentry's automatic Vercel Cron Monitor instrumentation (next.config.ts,
  // automaticVercelMonitors) doesn't cover App Router route handlers yet,
  // so this cron had zero monitoring: a claim failure was swallowed to a
  // plain console.error (see processCrawlJobBatch) and only ever showed up
  // if someone went looking at raw logs — which is exactly what happened
  // for ~2.5 days of near-total failure on 2026-09-11–14. withMonitor
  // check-ins here mean Sentry's own Crons dashboard now tracks this job's
  // liveness and can alert when it goes quiet or starts failing, instead of
  // that only being discoverable after the fact.
  const result = await Sentry.withMonitor(
    "crawl-worker",
    async () => {
      const supabase = createAdminClient();
      const batch = await processCrawlJobBatch(supabase);
      const finalized = await finalizeCompletedRuns(supabase);
      // processCrawlJobBatch swallows a claim failure into a normal-looking
      // empty result (see its own comment) so this tick's cron response
      // doesn't itself count as a crash — surface it here instead, so the
      // check-in this wraps still registers as a failure.
      if (batch.claimFailed) {
        throw new Error("crawl-worker: failed to claim crawl jobs");
      }
      return { batch, finalized };
    },
    { schedule: { type: "crontab", value: "*/2 * * * *" }, checkinMargin: 2, maxRuntime: 5 }
  );

  return NextResponse.json({ ok: true, ...result });
}
