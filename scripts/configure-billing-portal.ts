// Enables self-serve tier switching in the Stripe Customer Portal.
//
// Usage: npx tsx scripts/configure-billing-portal.ts
//
// Safe to re-run: updates the account's active/default portal configuration
// in place rather than creating a new one each time.
//
// Policy (per product decision): upgrades apply immediately with prorated
// billing; downgrades are scheduled for the end of the current period
// (schedule_at_period_end: decreasing_item_amount) so a customer keeps what
// they already paid for.

import { config } from "dotenv";
import { join } from "node:path";
config({ path: join(process.cwd(), ".env.local") });

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-06-24.dahlia" });

const PRICE_ENV_VARS = [
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_STARTER_ANNUAL",
  "STRIPE_PRICE_PLUS",
  "STRIPE_PRICE_PLUS_ANNUAL",
  "STRIPE_PRICE_ADVANCED",
  "STRIPE_PRICE_ADVANCED_ANNUAL",
] as const;

async function main() {
  const priceIds = PRICE_ENV_VARS.map((key) => {
    const value = process.env[key];
    if (!value) throw new Error(`${key} is not set in .env.local`);
    return value;
  });

  // Resolve each price back to its product, then de-dupe — one product per
  // tier, each with a monthly + annual price.
  const prices = await Promise.all(priceIds.map((id) => stripe.prices.retrieve(id)));
  const productIds = [...new Set(prices.map((p) => (typeof p.product === "string" ? p.product : p.product.id)))];

  const products: Stripe.BillingPortal.ConfigurationCreateParams.Features.SubscriptionUpdate.Product[] =
    productIds.map((productId) => ({
      product: productId,
      prices: prices.filter((p) => (typeof p.product === "string" ? p.product : p.product.id) === productId).map((p) => p.id),
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
      features: { ...toCreateFeatures(current.features), subscription_update: subscriptionUpdate },
    });
    console.log(`Updated existing default portal configuration: ${updated.id}`);
  } else {
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
    console.log(`Created new portal configuration: ${created.id}`);
  }

  console.log(`Products enabled for tier switching: ${productIds.join(", ")}`);
}

// The list/retrieve response shape (Configuration.Features) differs slightly
// from the create/update params shape (ConfigurationCreateParams.Features) —
// only the fields we're not touching need to survive the round-trip.
function toCreateFeatures(
  features: Stripe.BillingPortal.Configuration.Features
): Stripe.BillingPortal.ConfigurationUpdateParams.Features {
  return {
    customer_update: features.customer_update
      ? { enabled: features.customer_update.enabled, allowed_updates: features.customer_update.allowed_updates }
      : undefined,
    invoice_history: features.invoice_history ? { enabled: features.invoice_history.enabled } : undefined,
    payment_method_update: features.payment_method_update
      ? { enabled: features.payment_method_update.enabled }
      : undefined,
    subscription_cancel: features.subscription_cancel
      ? {
          enabled: features.subscription_cancel.enabled,
          cancellation_reason: features.subscription_cancel.cancellation_reason
            ? {
                enabled: features.subscription_cancel.cancellation_reason.enabled,
                options: features.subscription_cancel.cancellation_reason.options,
              }
            : undefined,
          mode: features.subscription_cancel.mode,
          proration_behavior: features.subscription_cancel.proration_behavior,
        }
      : undefined,
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
