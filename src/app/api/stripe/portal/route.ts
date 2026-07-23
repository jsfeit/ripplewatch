import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

// Stripe's hosted Customer Portal handles upgrade/downgrade/cancel/payment
// method updates — recommended over building custom subscription management
// UI (see Stripe billing best practices).
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
    .select("stripe_customer_id")
    .eq("id", profile.account_id)
    .single();

  if (!account?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing account yet — choose a paid plan first." },
      { status: 400 }
    );
  }

  const origin = new URL(request.url).origin;
  const session = await getStripe().billingPortal.sessions.create({
    customer: account.stripe_customer_id,
    return_url: `${origin}/app/settings`,
  });

  return NextResponse.json({ url: session.url });
}
