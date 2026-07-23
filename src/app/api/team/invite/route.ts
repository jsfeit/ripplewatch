import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SEAT_LIMIT, seatLimitLabel } from "@/lib/tier-limits";
import { sendInviteEmail } from "@/lib/resend";

// Members + pending invites for the caller's own account, so Settings can
// render one combined "who has access" list.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();
  if (!profile?.account_id) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 400 });
  }

  // Member emails live in auth.users, not reachable through the RLS-scoped
  // client, so this list is built with the admin client — still filtered to
  // the caller's own account_id, just not RLS-enforced for the join.
  const admin = createAdminClient();
  const { data: memberProfiles } = await admin
    .from("profiles")
    .select("id, role, created_at")
    .eq("account_id", profile.account_id);

  const members = await Promise.all(
    (memberProfiles ?? []).map(async (p) => {
      const { data: authUser } = await admin.auth.admin.getUserById(p.id);
      return { id: p.id, email: authUser.user?.email ?? "Unknown", role: p.role, createdAt: p.created_at };
    })
  );

  const { data: invites } = await supabase
    .from("invites")
    .select("*")
    .eq("account_id", profile.account_id)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  return NextResponse.json({ members, invites: invites ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();
  if (!profile?.account_id) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 400 });
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("name, tier")
    .eq("id", profile.account_id)
    .single();
  if (!account) {
    return NextResponse.json({ error: "Account not found." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ count: memberCount }, { count: pendingCount }] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("account_id", profile.account_id),
    admin
      .from("invites")
      .select("id", { count: "exact", head: true })
      .eq("account_id", profile.account_id)
      .is("accepted_at", null),
  ]);

  const seatLimit = SEAT_LIMIT[account.tier];
  const seatsUsed = (memberCount ?? 0) + (pendingCount ?? 0);
  if (seatsUsed >= seatLimit) {
    return NextResponse.json(
      { error: `Your plan includes ${seatLimitLabel(account.tier)} seats. Upgrade to invite more people.` },
      { status: 403 }
    );
  }

  const { data: invite, error } = await supabase
    .from("invites")
    .insert({ account_id: profile.account_id, email, invited_by: user.id })
    .select("*")
    .single();

  if (error) {
    // Most likely the (account_id, email) unique constraint — already invited.
    return NextResponse.json({ error: "That email has already been invited." }, { status: 409 });
  }

  const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invite.token}`;
  await sendInviteEmail(email, account.name, acceptUrl);

  return NextResponse.json({ invite });
}
