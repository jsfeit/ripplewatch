import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSlackWeeklyDigest } from "@/lib/slack";
import { generateWeeklyAccountIntelligence } from "@/lib/digest";
import { mapWithConcurrency } from "@/lib/crawl";
import type { Database } from "@/lib/supabase/types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];

const ACCOUNT_CONCURRENCY = 5;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Runs hourly, not weekly — the actual "once a week, at this account's
// preferred local time" cadence comes from checking every account's own
// timezone/day/hour against the current moment on each run, not from the
// cron schedule itself. A single fixed-UTC weekly trigger (like
// /api/cron/digest-weekly uses for email) can't honor "Sunday night in
// the user's own timezone" for every account at once — Sunday 8pm in
// Auckland and Sunday 8pm in Los Angeles are ~19 hours apart in UTC.
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function localDayAndHour(timezone: string, at: Date): { day: number; hour: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "numeric",
      hour12: false,
    }).formatToParts(at);
    const weekday = parts.find((p) => p.type === "weekday")?.value;
    const hourRaw = parts.find((p) => p.type === "hour")?.value;
    if (!weekday || !hourRaw || !(weekday in WEEKDAY_INDEX)) return null;
    // hour12:false renders midnight as "24" in some locales/engines rather
    // than "0" — normalize so the 0-23 comparison against slack_digest_hour
    // below doesn't silently miss every account whose window is midnight.
    const hour = parseInt(hourRaw, 10) % 24;
    return { day: WEEKDAY_INDEX[weekday], hour };
  } catch {
    // An invalid/unrecognized IANA timezone string (shouldn't happen once
    // the settings UI only offers real Intl.supportedValuesOf("timeZone")
    // entries, but a stale DB value from before that validation existed is
    // still possible) — skip this account's send rather than crash the run.
    return null;
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const now = new Date();

  const supabase = createAdminClient();
  const { data: accounts } = await supabase.from("accounts").select("*").eq("status", "active");

  const summary = await mapWithConcurrency(accounts ?? [], ACCOUNT_CONCURRENCY, async (account: Account) => {
    const local = localDayAndHour(account.timezone, now);
    if (!local || local.day !== account.slack_digest_day || local.hour !== account.slack_digest_hour) return null;

    // Guards against a double-send if this run and an adjacent hour's run
    // both land inside the same local send-window (DST edge, a cron retry,
    // a manually re-triggered invocation) — one send per rolling week.
    if (account.slack_digest_sent_at) {
      const sinceLastSend = now.getTime() - new Date(account.slack_digest_sent_at).getTime();
      if (sinceLastSend < SEVEN_DAYS_MS - 60 * 60 * 1000) return null;
    }

    const { data: slackIntegration } = await supabase
      .from("integrations")
      .select("*")
      .eq("account_id", account.id)
      .eq("provider", "slack")
      .eq("connected", true)
      .maybeSingle();
    if (!slackIntegration?.credentials) return null;

    const { data: competitors } = await supabase
      .from("competitors")
      .select("id, name")
      .eq("account_id", account.id);
    if (!competitors || competitors.length === 0) return null;

    const competitorIds = competitors.map((c) => c.id);
    const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS).toISOString();
    const { data: weekSignals } = await supabase
      .from("signals")
      .select("relevance_level")
      .in("competitor_id", competitorIds)
      .in("relevance_level", ["High", "Medium"])
      .gte("created_at", sevenDaysAgo)
      .neq("source", "backfill");

    const highCount = (weekSignals ?? []).filter((s) => s.relevance_level === "High").length;
    const mediumCount = (weekSignals ?? []).filter((s) => s.relevance_level === "Medium").length;

    // Shared with the weekly email cron — see generateWeeklyAccountIntelligence
    // for why this regenerates rather than reading back whatever the email
    // cron's own Monday run last cached (this account's chosen send time
    // may be days away from that).
    const { verdict, trendsDigest } = await generateWeeklyAccountIntelligence(supabase, account, competitors);

    try {
      await sendSlackWeeklyDigest(slackIntegration.credentials as Parameters<typeof sendSlackWeeklyDigest>[0], {
        accountName: account.name,
        verdict,
        trendsDigest,
        highCount,
        mediumCount,
        dashboardUrl: `${appUrl}/app/dashboard`,
      });
    } catch (err) {
      console.error(`weekly Slack digest send failed for ${account.name}:`, err);
      return { account: account.name, sent: false, error: true };
    }

    await supabase.from("accounts").update({ slack_digest_sent_at: now.toISOString() }).eq("id", account.id);
    return { account: account.name, sent: true, highCount, mediumCount };
  });

  return NextResponse.json({ ok: true, summary: summary.filter(Boolean) });
}
