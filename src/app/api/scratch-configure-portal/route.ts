import { NextResponse } from "next/server";
import { getStripe, getPriceId } from "@/lib/stripe";
import type Stripe from "stripe";

// TEMPORARY — one-time application of the Billing Portal configuration
// (subscription_update enabled for tier switching) against PRODUCTION
// Stripe, mirroring scripts/configure-billing-portal.ts (already run in
// test mode). Removed right after confirming it applied.
const SCRATCH_TOKEN = "9c4eb802755a8264729c70bcc2889f5cb2d4162ce4dbb51d";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("token") !== SCRATCH_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();

  const priceIds = (
    [
      ["starter", "monthly"],
      ["starter", "annual"],
      ["plus", "monthly"],
      ["plus", "annual"],
      ["advanced", "monthly"],
      ["advanced", "annual"],
    ] as const
  ).map(([tier, period]) => {
    const id = getPriceId(tier, period);
    if (!id) throw new Error(`Price for ${tier}/${period} not configured.`);
    return id;
  });

  const prices = await Promise.all(priceIds.map((id) => stripe.prices.retrieve(id)));
  const productIds = [...new Set(prices.map((p) => (typeof p.product === "string" ? p.product : p.product.id)))];

  const products: Stripe.BillingPortal.ConfigurationCreateParams.Features.SubscriptionUpdate.Product[] =
    productIds.map((productId) => ({
      product: productId,
      prices: prices
        .filter((p) => (typeof p.product === "string" ? p.product : p.product.id) === productId)
        .map((p) => p.id),
    }));

  const subscriptionUpdate: Stripe.BillingPortal.ConfigurationCreateParams.Features.SubscriptionUpdate = {
    enabled: true,
    default_allowed_updates: ["price"],
    proration_behavior: "create_prorations",
    schedule_at_period_end: { conditions: [{ type: "decreasing_item_amount" }] },
    products,
  };

  const existing = await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 });
  const current = existing.data[0];

  if (current) {
    const updated = await stripe.billingPortal.configurations.update(current.id, {
      features: {
        customer_update: current.features.customer_update
          ? {
              enabled: current.features.customer_update.enabled,
              allowed_updates: current.features.customer_update.allowed_updates,
            }
          : undefined,
        invoice_history: current.features.invoice_history
          ? { enabled: current.features.invoice_history.enabled }
          : undefined,
        payment_method_update: current.features.payment_method_update
          ? { enabled: current.features.payment_method_update.enabled }
          : undefined,
        subscription_cancel: current.features.subscription_cancel
          ? {
              enabled: current.features.subscription_cancel.enabled,
              cancellation_reason: current.features.subscription_cancel.cancellation_reason
                ? {
                    enabled: current.features.subscription_cancel.cancellation_reason.enabled,
                    options: current.features.subscription_cancel.cancellation_reason.options,
                  }
                : undefined,
              mode: current.features.subscription_cancel.mode,
              proration_behavior: current.features.subscription_cancel.proration_behavior,
            }
          : undefined,
        subscription_update: subscriptionUpdate,
      },
    });
    return NextResponse.json({ action: "updated", configurationId: updated.id, productIds });
  }

  const created = await stripe.billingPortal.configurations.create({
    business_profile: { headline: "Ripplewatch" },
    features: {
      customer_update: { enabled: true, allowed_updates: ["email", "address", "tax_id"] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true },
      subscription_update: subscriptionUpdate,
    },
  });
  return NextResponse.json({ action: "created", configurationId: created.id, productIds });
}
