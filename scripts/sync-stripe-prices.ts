// Provisions/updates Stripe products + prices from src/lib/pricing.ts, and
// writes the resulting monthly price IDs into .env.local automatically.
//
// Usage: npm run stripe:sync-prices
//
// Safe to re-run: finds each tier's product by metadata.tier, archives any
// prices that no longer match the current config (Stripe prices can't be
// edited, only archived + replaced), and creates fresh ones.

import { config } from "dotenv";
import { join } from "node:path";
config({ path: join(process.cwd(), ".env.local") });

import Stripe from "stripe";
import { readFileSync, writeFileSync } from "node:fs";
import {
  MONTHLY_PRICE_USD,
  PRODUCT_TAX_CODE,
  ANNUAL_DISCOUNT_PERCENT,
  annualPriceCents,
  monthlyPriceCents,
  type TierKey,
} from "../src/lib/pricing";

const DISPLAY_NAMES: Record<TierKey, string> = {
  starter: "Starter",
  plus: "Plus",
  advanced: "Advanced",
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-06-24.dahlia" });

async function findOrCreateProduct(tier: TierKey, displayName: string) {
  const existing = await stripe.products.search({
    query: `metadata['tier']:'${tier}' AND active:'true'`,
  });
  if (existing.data[0]) return existing.data[0];

  return stripe.products.create({
    name: `Ripplewatch ${displayName}`,
    tax_code: PRODUCT_TAX_CODE,
    metadata: { tier },
  });
}

async function archiveOldPrices(productId: string) {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  for (const price of prices.data) {
    await stripe.prices.update(price.id, { active: false });
  }
}

async function createPrices(productId: string, monthlyUsd: number) {
  const monthly = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: monthlyPriceCents(monthlyUsd),
    recurring: { interval: "month" },
    tax_behavior: "exclusive",
  });

  const annual = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: annualPriceCents(monthlyUsd),
    recurring: { interval: "year" },
    tax_behavior: "exclusive",
    metadata: { discount_percent: String(ANNUAL_DISCOUNT_PERCENT) },
  });

  return { monthly, annual };
}

async function main() {
  const results: Record<TierKey, { monthly: string; annual: string }> = {} as never;

  for (const [tier, monthlyUsd] of Object.entries(MONTHLY_PRICE_USD) as [TierKey, number][]) {
    const displayName = DISPLAY_NAMES[tier];
    const product = await findOrCreateProduct(tier, displayName);
    await archiveOldPrices(product.id);
    const { monthly, annual } = await createPrices(product.id, monthlyUsd);
    results[tier] = { monthly: monthly.id, annual: annual.id };
    console.log(
      `${displayName}: $${monthlyUsd}/mo (${monthly.id}), $${annualPriceCents(monthlyUsd) / 100}/yr (${annual.id})`
    );
  }

  const envPath = join(process.cwd(), ".env.local");
  let env = readFileSync(envPath, "utf-8");
  env = env.replace(/^STRIPE_PRICE_STARTER=.*$/m, `STRIPE_PRICE_STARTER=${results.starter.monthly}`);
  env = env.replace(/^STRIPE_PRICE_PLUS=.*$/m, `STRIPE_PRICE_PLUS=${results.plus.monthly}`);
  if (!env.includes("STRIPE_PRICE_STARTER_ANNUAL")) {
    env += `\nSTRIPE_PRICE_STARTER_ANNUAL=${results.starter.annual}`;
    env += `\nSTRIPE_PRICE_PLUS_ANNUAL=${results.plus.annual}`;
    env += `\nSTRIPE_PRICE_ADVANCED=${results.advanced.monthly}`;
    env += `\nSTRIPE_PRICE_ADVANCED_ANNUAL=${results.advanced.annual}\n`;
  } else {
    env = env.replace(/^STRIPE_PRICE_STARTER_ANNUAL=.*$/m, `STRIPE_PRICE_STARTER_ANNUAL=${results.starter.annual}`);
    env = env.replace(/^STRIPE_PRICE_PLUS_ANNUAL=.*$/m, `STRIPE_PRICE_PLUS_ANNUAL=${results.plus.annual}`);
    if (env.includes("STRIPE_PRICE_ADVANCED=")) {
      env = env.replace(/^STRIPE_PRICE_ADVANCED=.*$/m, `STRIPE_PRICE_ADVANCED=${results.advanced.monthly}`);
      env = env.replace(
        /^STRIPE_PRICE_ADVANCED_ANNUAL=.*$/m,
        `STRIPE_PRICE_ADVANCED_ANNUAL=${results.advanced.annual}`
      );
    } else {
      env += `\nSTRIPE_PRICE_ADVANCED=${results.advanced.monthly}`;
      env += `\nSTRIPE_PRICE_ADVANCED_ANNUAL=${results.advanced.annual}\n`;
    }
  }
  writeFileSync(envPath, env);

  console.log("\n.env.local updated. Restart the dev server to pick up the new price IDs.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
