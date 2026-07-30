import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, getPriceId, type BillingPeriod } from "@/lib/stripe";

// Self-serve checkout for all three tiers.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const requestedTier: unknown = body?.tier;
  const requestedPeriod: unknown = body?.period;

  if (requestedTier !== "starter" && requestedTier !== "plus" && requestedTier !== "advanced") {
    return NextResponse.json({ error: "Unknown tier." }, { status: 400 });
  }
  const tier: "starter" | "plus" | "advanced" = requestedTier;

  const period: BillingPeriod = requestedPeriod === "annual" ? "annual" : "monthly";

  const priceId = getPriceId(tier, period);
  if (!priceId) {
    return NextResponse.json(
      { error: `Price for ${tier}/${period} is not configured.` },
      { status: 500 }
    );
  }

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
    return NextResponse.json(
      { error: "Finish onboarding before choosing a plan." },
      { status: 400 }
    );
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("stripe_customer_id")
    .eq("id", profile.account_id)
    .single();

  const origin = new URL(request.url).origin;

  try {
    // Embedded (renders inline via @stripe/react-stripe-js) instead of the
    // classic hosted redirect — same Stripe-managed form/PCI scope, just no
    // full-page navigation away from the app. Embedded mode takes a single
    // return_url (used after completion) rather than separate success/cancel
    // URLs; the session_id lets the return page confirm what happened if it
    // ever needs to.
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      // Named "embedded_page" as of API version 2026-06-24.dahlia (the plain
      // "embedded" value from older Stripe docs/examples was renamed) —
      // this is still the prebuilt embedded form @stripe/react-stripe-js's
      // <EmbeddedCheckout> expects, not the newer DIY "elements"/"form" modes.
      ui_mode: "embedded_page",
      customer: account?.stripe_customer_id ?? undefined,
      customer_email: account?.stripe_customer_id ? undefined : user.email,
      client_reference_id: profile.account_id,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      // Collects zero tax until you have an active Tax Registration for the
      // customer's jurisdiction (dashboard.stripe.com/tax/registrations) —
      // Stripe doesn't error in that case, it just silently taxes nothing.
      automatic_tax: { enabled: true },
      metadata: { account_id: profile.account_id, tier, period },
      subscription_data: { metadata: { account_id: profile.account_id, tier, period } },
      return_url: `${origin}/app/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    });

    return NextResponse.json({ clientSecret: session.client_secret });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start checkout.";
    console.error("stripe checkout session creation failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
