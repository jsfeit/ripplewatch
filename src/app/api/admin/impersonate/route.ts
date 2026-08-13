import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { IMPERSONATION_COOKIE } from "@/lib/impersonation";

// Gated by middleware (/api/admin/:path* requires an admin session) — this
// route only needs to look up the caller's own id/email for the audit log.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const accountId: unknown = body?.accountId;
  if (typeof accountId !== "string" || !accountId) {
    return NextResponse.json({ error: "accountId is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const admin = createAdminClient();
  const { data: account } = await admin.from("accounts").select("id, name").eq("id", accountId).maybeSingle();
  if (!account) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const { data: log, error } = await admin
    .from("admin_impersonation_log")
    .insert({
      admin_id: user.id,
      admin_email: user.email ?? "unknown",
      target_account_id: account.id,
      target_account_name: account.name,
    })
    .select("id")
    .single();
  if (error || !log) {
    return NextResponse.json({ error: error?.message ?? "Could not start view-as session." }, { status: 500 });
  }

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE, log.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  const logId = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  cookieStore.delete(IMPERSONATION_COOKIE);

  if (logId) {
    const admin = createAdminClient();
    await admin
      .from("admin_impersonation_log")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", logId)
      .is("ended_at", null);
  }

  return NextResponse.json({ ok: true });
}
