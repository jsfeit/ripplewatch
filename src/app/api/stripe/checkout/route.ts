import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, getPriceId, type BillingPeriod } from "@/lib/stripe";
import { getCheckoutCampaign } from "@/lib/promo-campaign";
import { TIERS } from "@/lib/tiers";

// Self-serve checkout for all three tiers.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const requestedTier: unknown = body?.tier;
  const requestedPeriod: unknown = body?.period;
  // Allowlisted rather than trusted as-is: this becomes part of the
  // redirect URL Stripe sends the browser to after payment, so an
  // unvalidated client-supplied path would be an open redirect. Onboarding
  // (a brand-new account, nothing to see in Settings yet) wants /app/dashboard;
  // every other caller (Settings' own upgrade flow) keeps the existing default.
  const ALLOWED_RETURN_PATHS = ["/app/dashboard", "/app/settings"] as const;
  const requestedReturnPath: unknown = body?.returnPath;
  const returnPath = ALLOWED_RETURN_PATHS.includes(requestedReturnPath as (typeof ALLOWED_RETURN_PATHS)[number])
    ? (requestedReturnPath as (typeof ALLOWED_RETURN_PATHS)[number])
    : "/app/settings";

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

  // Auto-applied, not a code the customer types in — allow_promotion_codes
  // and discounts are mutually exclusive on a Checkout Session, so an
  // active campaign takes over the promo-code field entirely for this
  // session rather than sitting alongside it. This route is only ever hit
  // for a customer's first paid checkout (an existing subscriber changing
  // tiers goes through /api/stripe/change-plan and the Billing Portal
  // instead), so "active campaign + eligible tier" already means "initial
  // signup" without any extra new-customer check here.
  const tierIsSelfServe = TIERS.find((t) => t.id === tier)?.selfServe ?? false;
  const campaign = tierIsSelfServe ? await getCheckoutCampaign() : null;

  // Embedded (renders inline via @stripe/react-stripe-js) instead of the
  // classic hosted redirect — same Stripe-managed form/PCI scope, just no
  // full-page navigation away from the app. Embedded mode takes a single
  // return_url (used after completion) rather than separate success/cancel
  // URLs; the session_id lets the return page confirm what happened if it
  // ever needs to.
  const baseParams = {
    mode: "subscription" as const,
    // Named "embedded_page" as of API version 2026-06-24.dahlia (the plain
    // "embedded" value from older Stripe docs/examples was renamed) — this
    // is still the prebuilt embedded form @stripe/react-stripe-js's
    // <EmbeddedCheckout> expects, not the newer DIY "elements"/"form" modes.
    ui_mode: "embedded_page" as const,
    customer: account?.stripe_customer_id ?? undefined,
    customer_email: account?.stripe_customer_id ? undefined : user.email,
    client_reference_id: profile.account_id,
    line_items: [{ price: priceId, quantity: 1 }],
    // Collects zero tax until you have an active Tax Registration for the
    // customer's jurisdiction (dashboard.stripe.com/tax/registrations) —
    // Stripe doesn't error in that case, it just silently taxes nothing.
    automatic_tax: { enabled: true },
    metadata: { account_id: profile.account_id, tier, period },
    subscription_data: { metadata: { account_id: profile.account_id, tier, period } },
    return_url: `${origin}${returnPath}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
  };

  try {
    const session = await getStripe().checkout.sessions.create({
      ...baseParams,
      ...(campaign
        ? { discounts: [{ coupon: campaign.stripeCouponId }] }
        : { allow_promotion_codes: true }),
    });
    return NextResponse.json({ clientSecret: session.client_secret });
  } catch (err) {
    // A promo campaign's coupon can go stale (deleted/archived directly in
    // the Stripe dashboard) without anything here knowing — without this
    // fallback, that single bad coupon ID would silently block every new
    // signup, not just the ones eligible for the promo. Retry once without
    // the discount rather than failing the whole checkout over it.
    if (campaign) {
      console.error("checkout with promo coupon failed, retrying without it:", err);
      try {
        const session = await getStripe().checkout.sessions.create({
          ...baseParams,
          allow_promotion_codes: true,
        });
        return NextResponse.json({ clientSecret: session.client_secret });
      } catch (retryErr) {
        const message = retryErr instanceof Error ? retryErr.message : "Could not start checkout.";
        console.error("stripe checkout session creation failed (retry without coupon):", message);
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }
    const message = err instanceof Error ? err.message : "Could not start checkout.";
    console.error("stripe checkout session creation failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
