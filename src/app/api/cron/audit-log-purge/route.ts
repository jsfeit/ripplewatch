import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUDIT_RETENTION_MONTHS } from "@/lib/audit";

// Daily: removes audit entries older than the retention period (12 months).
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - AUDIT_RETENTION_MONTHS);
  const { error, count } = await createAdminClient()
    .from("audit_log")
    .delete({ count: "exact" })
    .lt("created_at", cutoff.toISOString());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ purged: count ?? 0, olderThan: cutoff.toISOString() });
}
