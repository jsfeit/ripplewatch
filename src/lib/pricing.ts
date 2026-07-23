// Single source of truth for tier pricing — used by both the app (pricing
// page, settings) and scripts/sync-stripe-prices.ts. Edit the numbers here,
// then run `npm run stripe:sync-prices` to push the change to Stripe.

export const ANNUAL_DISCOUNT_PERCENT = 20;

// Business-use SaaS — confirmed against Stripe's live Tax Codes API
// (txcd_10103001), not guessed. Revisit if positioning changes (e.g. selling
// to individuals rather than companies would be txcd_10103000 instead).
export const PRODUCT_TAX_CODE = "txcd_10103001";

export const MONTHLY_PRICE_USD = {
  starter: 49,
  plus: 149,
  plus_human: 499,
} as const;

export type TierKey = keyof typeof MONTHLY_PRICE_USD;

export function annualPriceUsd(monthlyUsd: number): number {
  return Math.round(monthlyUsd * 12 * (1 - ANNUAL_DISCOUNT_PERCENT / 100) * 100) / 100;
}

export function annualPriceCents(monthlyUsd: number): number {
  return Math.round(annualPriceUsd(monthlyUsd) * 100);
}

export function monthlyPriceCents(monthlyUsd: number): number {
  return Math.round(monthlyUsd * 100);
}
