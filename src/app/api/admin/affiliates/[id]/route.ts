import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Gated by middleware (/api/admin/:path* requires an admin session).
const VALID_STATUSES = new Set(["pending", "contacted", "approved", "rejected"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = typeof body?.status === "string" ? body.status : "";

  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const { error } = await createAdminClient().from("affiliate_applications").update({ status }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
