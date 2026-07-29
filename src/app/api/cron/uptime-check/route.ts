import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendUptimeAlertEmail } from "@/lib/resend";

const CHECK_ID = "uptime";
const TIMEOUT_MS = 10_000;

// Runs every few minutes. Only alerts on a status transition (up->down or
// down->up), not on every tick while an outage persists — see
// supabase/migrations/0018_uptime_check_state.sql.
//
// Limitation: this check runs on the same platform it's checking, so a full
// Vercel outage would take the cron down with it and no alert would fire.
// It still catches what actually breaks in practice — app crashes, database
// connectivity issues, bad deploys — just not a platform-wide outage.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  let ok = false;
  let detail = "";
  try {
    const res = await fetch(appUrl, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    ok = res.ok;
    detail = `HTTP ${res.status}`;
  } catch (err) {
    detail = err instanceof Error ? err.message : "Unknown fetch error";
  }

  const status = ok ? "up" : "down";
  const supabase = createAdminClient();
  const { data: previous } = await supabase
    .from("system_health")
    .select("last_status")
    .eq("id", CHECK_ID)
    .single();

  const transitioned = previous?.last_status !== status;

  if (transitioned) {
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);

    try {
      if (!ok) {
        await sendUptimeAlertEmail(adminEmails, detail);
      } else if (previous?.last_status === "down") {
        await sendUptimeAlertEmail(adminEmails, "Recovered — the last check succeeded.");
      }
    } catch (err) {
      console.error("uptime-check: failed to send alert email", err);
    }
  }

  await supabase.from("system_health").upsert({ id: CHECK_ID, last_status: status, updated_at: new Date().toISOString() });

  return NextResponse.json({ ok, status, transitioned, detail });
}
