import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createConnectSignupSession, createConnectTopupSession, parseFundingUsd } from "@/lib/connect-billing";

// Starts an embedded Stripe Checkout for Ripplewatch Connect.
//   kind "signup": the $29/month platform fee plus the first balance, in one
//                  payment (a Connect account that hasn't subscribed yet).
//   kind "topup":  add funds to an existing Connect account.
// The funding amount is validated here; it becomes the number of credits.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const fundingUsd = parseFundingUsd(body?.fundingUsd);
  if (fundingUsd === null) {
    return NextResponse.json({ error: "Choose an amount of $50 or more, in whole dollars." }, { status: 400 });
  }
  const kind = body?.kind === "topup" ? "topup" : "signup";

  const { data: profile } = await supabase.from("profiles").select("account_id").eq("id", user.id).single();
  if (!profile?.account_id) return NextResponse.json({ error: "Create your account first." }, { status: 400 });

  const { data: account } = await createAdminClient()
    .from("accounts")
    .select("id, stripe_customer_id, stripe_subscription_id, contact_email, tier, demo_mode")
    .eq("id", profile.account_id)
    .single();
  if (!account || account.tier !== "connect") {
    return NextResponse.json({ error: "This account isn't a Ripplewatch Connect account." }, { status: 400 });
  }
  if (account.demo_mode) return NextResponse.json({ error: "Billing is disabled for demo accounts." }, { status: 403 });

  const origin = new URL(request.url).origin;
  try {
    if (kind === "topup") {
      if (!account.stripe_subscription_id) {
        return NextResponse.json({ error: "Start your subscription first." }, { status: 400 });
      }
      return NextResponse.json(await createConnectTopupSession(account, { fundingUsd, origin }));
    }
    if (account.stripe_subscription_id) {
      return NextResponse.json({ error: "You're already subscribed. Add funds from Settings instead." }, { status: 400 });
    }
    return NextResponse.json(await createConnectSignupSession(account, { fundingUsd, userEmail: user.email!, origin }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start checkout.";
    console.error("connect checkout failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
