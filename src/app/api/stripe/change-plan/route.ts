import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, getPriceId } from "@/lib/stripe";

// For an account that already has an active subscription, switching tiers
// should never go through Checkout again — that creates a second,
// simultaneous subscription instead of changing the existing one. This
// deep-links straight into the Customer Portal's "confirm this change" flow
// (Stripe-hosted, pre-filled with the existing card and email) instead of
// dropping the customer on the generic portal homepage to find it
// themselves. Brand-new customers with no subscription yet still use
// /api/stripe/checkout.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const requestedTier: unknown = body?.tier;

  if (requestedTier !== "starter" && requestedTier !== "plus" && requestedTier !== "advanced") {
    return NextResponse.json({ error: "Unknown tier." }, { status: 400 });
  }
  const tier: "starter" | "plus" | "advanced" = requestedTier;

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
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("id", profile.account_id)
    .single();

  if (!account?.stripe_customer_id || !account.stripe_subscription_id) {
    return NextResponse.json(
      { error: "No active subscription to change — start checkout instead." },
      { status: 400 }
    );
  }

  const origin = new URL(request.url).origin;

  try {
    const subscription = await getStripe().subscriptions.retrieve(account.stripe_subscription_id);
    const item = subscription.items.data[0];
    if (!item) {
      return NextResponse.json({ error: "Subscription has no items to change." }, { status: 500 });
    }

    // Scope is tier-only — stay on whichever interval (monthly/annual) the
    // customer is already on rather than accepting a client-supplied period,
    // so this endpoint can never silently also switch billing period.
    const currentInterval = item.price.recurring?.interval === "year" ? "annual" : "monthly";
    const priceId = getPriceId(tier, currentInterval);
    if (!priceId) {
      return NextResponse.json(
        { error: `Price for ${tier}/${currentInterval} is not configured.` },
        { status: 500 }
      );
    }

    // Already on this exact price — nothing to confirm.
    if (item.price.id === priceId) {
      return NextResponse.json({ error: "Already on this plan." }, { status: 400 });
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: account.stripe_customer_id,
      return_url: `${origin}/app/settings?checkout=success`,
      flow_data: {
        type: "subscription_update_confirm",
        subscription_update_confirm: {
          subscription: account.stripe_subscription_id,
          items: [{ id: item.id, price: priceId, quantity: 1 }],
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start plan change.";
    console.error("stripe change-plan session creation failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
