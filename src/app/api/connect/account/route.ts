import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Creates the account for someone buying Ripplewatch Connect. Unlike the
// dashboard onboarding this asks for nothing but a company name: competitors
// and positioning come later, from the assistant. The account starts on
// hold and is only activated by the Stripe webhook once the first payment
// clears, so an abandoned checkout leaves an inert row, not a free account.
//
// Created with the service-role client (not the caller's session) so the
// caller can't choose its own tier or status.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: existing } = await supabase.from("profiles").select("account_id").eq("id", user.id).single();
  if (existing?.account_id) return NextResponse.json({ ok: true, accountId: existing.account_id });

  const body = await request.json().catch(() => null);
  const companyName = typeof body?.companyName === "string" ? body.companyName.trim().slice(0, 120) : "";
  if (!companyName) return NextResponse.json({ error: "Enter your company name." }, { status: 400 });

  const admin = createAdminClient();
  const accountId = crypto.randomUUID();
  const { error: accountError } = await admin.from("accounts").insert({
    id: accountId,
    name: companyName,
    contact_email: user.email,
    created_by: user.id,
    tier: "connect",
    status: "hold",
  });
  if (accountError) {
    console.error("connect account insert failed:", accountError);
    return NextResponse.json({ error: "Could not create your account." }, { status: 500 });
  }

  const { error: profileError } = await supabase.from("profiles").update({ account_id: accountId }).eq("id", user.id);
  if (profileError) {
    console.error("connect profile link failed:", profileError);
    return NextResponse.json({ error: "Could not link the account to your profile." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, accountId });
}
