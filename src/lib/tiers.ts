import { MONTHLY_PRICE_USD, annualPriceUsd, ANNUAL_DISCOUNT_PERCENT } from "./pricing";

// One dashboard plan now (Starter and Advanced are gone; no paying customer
// was ever on either at the time each was removed). The id stays "plus" —
// it's the accounts.tier value and the Stripe price lookup key, and changing
// it would mean a migration and re-pointing Stripe for zero customer benefit
// — but the display name is "Ripplewatch Dashboard": the dashboard is now one
// product next to Ripplewatch Connect, not the middle rung of a ladder.
export type TierId = "plus";

export type Tier = {
  id: TierId;
  name: string;
  price: string;
  priceNote: string;
  annualNote: string;
  monthlyUsd: number;
  selfServe: boolean;
  tagline: string;
  // Used by the reactivate page's own compact summary (not the pricing
  // card, which reads `features` below).
  competitors: string;
  signalSources: string;
  relevanceScoring: string;
  // The pricing card's bullet list — short, one idea per line, and the same
  // count as Connect's own pricing-card list (see CONNECT_PRICING_FEATURES)
  // so the two cards land at the same height.
  features: string[];
  cta: string;
};

function annualNote(monthlyUsd: number): string {
  const formatted = annualPriceUsd(monthlyUsd).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `or $${formatted}/yr (${ANNUAL_DISCOUNT_PERCENT}% off)`;
}

export const TIERS: Tier[] = [
  {
    id: "plus",
    name: "Ripplewatch Dashboard",
    price: `$${MONTHLY_PRICE_USD.plus}`,
    priceNote: "/mo",
    annualNote: annualNote(MONTHLY_PRICE_USD.plus),
    monthlyUsd: MONTHLY_PRICE_USD.plus,
    selfServe: true,
    tagline:
      "Same scoring and competitive intelligence as Ripplewatch Connect, delivered as a shared dashboard your whole team logs into.",
    competitors: "Up to 20 competitors",
    signalSources: "Pricing, job postings, news, funding, product changes",
    relevanceScoring: "Full scoring + Momentum score",
    features: [
      "Up to 20 competitors tracked",
      "Full scoring + Momentum score",
      "Slack + email delivery",
      "HubSpot + call insights (Zoom, Gong soon)",
      "API access + visual change detection",
      "Unlimited seats, guided setup",
    ],
    // Sales-assisted for now, not instant self-serve checkout — see
    // pricing-cards.tsx, which links this CTA to booking a demo rather than
    // /onboarding. The checkout flow itself (onboarding-flow.tsx) is
    // untouched and still reachable directly, so turning self-serve back on
    // is a one-line link change, not a rebuild.
    cta: "Book a demo",
  },
];
