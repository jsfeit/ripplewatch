import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Gated by middleware (/api/admin/:path* requires an admin session).
// Pauses or resumes the automated lead-drip emails for one lead (see
// /api/cron/lead-drip and migration 0068).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.dripPaused !== "boolean") {
    return NextResponse.json({ error: "dripPaused must be true or false." }, { status: 400 });
  }

  const { error } = await createAdminClient()
    .from("leads")
    .update({ drip_paused_at: body.dripPaused ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
