// Creates (or reuses) the Ripplewatch Connect product and its $29/month
// platform-fee price in whichever Stripe account STRIPE_SECRET_KEY points at,
// and prints the price id to set as STRIPE_PRICE_CONNECT. Run it once per
// Stripe mode (test, then live). Safe to re-run: it reuses an existing
// active price at the same amount instead of creating a duplicate.
//
//   npx tsx scripts/sync-connect-price.ts
import Stripe from "stripe";
import { PRODUCT_TAX_CODE } from "../src/lib/pricing";
import { CONNECT_BASE_FEE_USD } from "../src/lib/connect-pricing";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-06-24.dahlia" });

async function main() {
  const existing = await stripe.products.search({ query: "metadata['tier']:'connect' AND active:'true'" });
  const product =
    existing.data[0] ??
    (await stripe.products.create({
      name: "Ripplewatch Connect",
      description: "Platform fee for Ripplewatch Connect. Usage is billed separately from a prepaid balance.",
      tax_code: PRODUCT_TAX_CODE,
      metadata: { tier: "connect" },
    }));

  const cents = Math.round(CONNECT_BASE_FEE_USD * 100);
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
  const match = prices.data.find((p) => p.unit_amount === cents && p.recurring?.interval === "month");
  const price =
    match ??
    (await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: cents,
      recurring: { interval: "month" },
      tax_behavior: "exclusive",
    }));

  console.log(`Product ${product.id}, price ${price.id} ($${CONNECT_BASE_FEE_USD}/month, ${match ? "reused" : "created"})`);
  console.log(`\nSet this in the environment for this Stripe mode:\nSTRIPE_PRICE_CONNECT=${price.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
