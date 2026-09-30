import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tier } from "@/lib/supabase/types";

const VALID_TIERS = ["connect", "plus"];
// A generous starter balance so testing Ask/MCP tool calls isn't blocked by
// an empty wallet — this account has no stripe_customer_id, so nothing here
// can ever trigger a real charge (maybeAutoReload no-ops without one).
const TEST_WALLET_STARTING_USD = 100;

// Admin-only self-serve way to try the real product — sign-up form,
// onboarding wizard, MCP — without an actual Stripe checkout. Distinct from
// the manual PATCH override in [id]/route.ts (which edits an existing
// account): this provisions a brand-new one, the same shape a real signup
// would leave behind (account + profile link, plus a funded wallet for
// Connect), except demo_mode is true and there's no Stripe subscription
// anywhere in it, so it costs nothing and is safe to delete with
// /api/admin/cleanup-test-data afterward.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const companyName = typeof body?.companyName === "string" ? body.companyName.trim() : "";
  const tier = body?.tier as Tier;

  if (!email || !companyName) {
    return NextResponse.json({ error: "Email and company name are required." }, { status: 400 });
  }
  if (!VALID_TIERS.includes(tier)) {
    return NextResponse.json({ error: "Tier must be connect or plus." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Reuse an existing auth user for this email (e.g. re-running a test with
  // the same address after a cleanup), but never an account that's already
  // provisioned — that would silently overwrite someone's real setup.
  const { data: existingList, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });
  let userId = existingList.users.find((u) => u.email?.toLowerCase() === email)?.id;

  if (userId) {
    const { data: existingProfile } = await admin.from("profiles").select("account_id").eq("id", userId).maybeSingle();
    if (existingProfile?.account_id) {
      return NextResponse.json(
        { error: "This email already has an account. Delete it first with cleanup-test-data." },
        { status: 400 }
      );
    }
  } else {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createError || !created.user) {
      return NextResponse.json({ error: createError?.message ?? "Could not create user." }, { status: 500 });
    }
    userId = created.user.id;
  }

  const accountId = crypto.randomUUID();
  const { error: accountError } = await admin.from("accounts").insert({
    id: accountId,
    name: companyName,
    tier,
    status: "active",
    demo_mode: true,
    contact_email: email,
    created_by: userId,
  });
  if (accountError) {
    return NextResponse.json({ error: `Could not create account: ${accountError.message}` }, { status: 500 });
  }

  const { error: profileError } = await admin.from("profiles").update({ account_id: accountId }).eq("id", userId);
  if (profileError) {
    return NextResponse.json({ error: `Could not link profile: ${profileError.message}` }, { status: 500 });
  }

  if (tier === "connect") {
    const { error: walletError } = await admin
      .from("connect_wallets")
      .insert({ account_id: accountId, balance_micros: TEST_WALLET_STARTING_USD * 1_000_000, auto_reload_enabled: false });
    if (walletError) console.error("test account wallet seed failed:", walletError.message);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const next = tier === "connect" ? "/app/get-started" : "/app/dashboard";
  // Routed through /auth/login-link rather than straight to `next`: a
  // generateLink() magiclink verifies on Supabase's domain and redirects
  // back with the session as #access_token=... in the URL hash (implicit
  // flow), which no server render ever sees — login-link-handler.tsx reads
  // that hash client-side and calls setSession() before forwarding on.
  const redirectTo = `${appUrl}/auth/login-link?next=${encodeURIComponent(next)}`;
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });
  if (linkError || !link.properties?.action_link) {
    return NextResponse.json(
      { ok: true, accountId, warning: "Account created, but the sign-in link failed — sign in manually via 'Forgot password'." },
      { status: 200 }
    );
  }

  return NextResponse.json({ ok: true, accountId, signInUrl: link.properties.action_link });
}
