import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SEAT_LIMIT, seatLimitLabel } from "@/lib/tier-limits";

// Runs through the admin client since the invitee's profile isn't linked to
// the target account yet, so it can't pass the invites RLS policy
// (account_id = auth_account_id()) at this point.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  if (!token) {
    return NextResponse.json({ error: "Missing invite token." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: invite } = await admin.from("invites").select("*").eq("token", token).single();

  if (!invite) {
    return NextResponse.json({ error: "This invite link isn't valid." }, { status: 404 });
  }
  if (invite.accepted_at) {
    return NextResponse.json({ error: "This invite has already been used." }, { status: 400 });
  }

  const { data: account } = await admin.from("accounts").select("tier").eq("id", invite.account_id).single();
  if (!account) {
    return NextResponse.json({ error: "That workspace no longer exists." }, { status: 404 });
  }

  const [{ count: memberCount }, { count: pendingCount }] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("account_id", invite.account_id),
    admin
      .from("invites")
      .select("id", { count: "exact", head: true })
      .eq("account_id", invite.account_id)
      .is("accepted_at", null),
  ]);
  const seatLimit = SEAT_LIMIT[account.tier];
  if ((memberCount ?? 0) >= seatLimit && (pendingCount ?? 0) <= 1) {
    return NextResponse.json(
      { error: `That workspace is at its ${seatLimitLabel(account.tier)}-seat limit.` },
      { status: 403 }
    );
  }

  // handle_new_user() already created this user's profile row (account_id
  // null) at signup — same pattern onboarding uses, just update instead of
  // insert.
  await admin
    .from("profiles")
    .update({ account_id: invite.account_id, role: invite.role })
    .eq("id", user.id);

  await admin.from("invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);

  return NextResponse.json({ ok: true });
}
