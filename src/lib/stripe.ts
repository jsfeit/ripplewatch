import "server-only";
import Stripe from "stripe";

let cachedStripe: Stripe | null = null;

// Lazily instantiated so the module can be imported (and the build can
// collect route data) even before STRIPE_SECRET_KEY is set — the Stripe SDK
// throws immediately on construction if the key is missing/empty.
export function getStripe(): Stripe {
  if (!cachedStripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured.");
    }
    cachedStripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-06-24.dahlia",
    });
  }
  return cachedStripe;
}

export type SelfServeTier = "starter" | "plus" | "advanced";
export type BillingPeriod = "monthly" | "annual";

// All three tiers are self-serve checkout now.
const PRICE_BY_TIER_AND_PERIOD: Record<SelfServeTier, Record<BillingPeriod, string | undefined>> = {
  starter: {
    monthly: process.env.STRIPE_PRICE_STARTER,
    annual: process.env.STRIPE_PRICE_STARTER_ANNUAL,
  },
  plus: {
    monthly: process.env.STRIPE_PRICE_PLUS,
    annual: process.env.STRIPE_PRICE_PLUS_ANNUAL,
  },
  advanced: {
    monthly: process.env.STRIPE_PRICE_ADVANCED,
    annual: process.env.STRIPE_PRICE_ADVANCED_ANNUAL,
  },
};

export function getPriceId(tier: SelfServeTier, period: BillingPeriod): string | undefined {
  return PRICE_BY_TIER_AND_PERIOD[tier][period];
}

// Maps every configured price ID (monthly and annual) back to its tier, so
// the webhook can sync accounts.tier regardless of which billing period a
// customer is on.
export const TIER_BY_PRICE: Record<string, SelfServeTier> = Object.fromEntries(
  (Object.entries(PRICE_BY_TIER_AND_PERIOD) as [SelfServeTier, Record<BillingPeriod, string | undefined>][]).flatMap(
    ([tier, periods]) =>
      Object.values(periods)
        .filter((price): price is string => Boolean(price))
        .map((price) => [price, tier])
  )
);
