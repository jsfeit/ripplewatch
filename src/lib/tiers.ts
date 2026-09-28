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
  competitors: string;
  signalSources: string;
  relevanceScoring: string;
  onboarding?: string;
  delivery: string;
  crm?: string;
  callIntel?: string;
  gong?: string;
  intercom?: string;
  apiAccess?: string;
  visualDiff?: string;
  seats: string;
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
    tagline: "A shared dashboard for the whole team: up to 20 competitors, HubSpot, call insights, and a guided setup.",
    competitors: "Up to 20 competitors",
    signalSources: "Pricing, job postings, news, funding, product changes",
    relevanceScoring: "Full scoring + Momentum score",
    onboarding: "Onboarding support",
    delivery: "Slack + email",
    crm: "HubSpot (read-only pull)",
    callIntel: "Zoom call insights",
    gong: "Gong (coming soon)",
    intercom: "Intercom (coming soon)",
    apiAccess: "Read-only API access",
    visualDiff: "Visual change detection",
    seats: "Unlimited",
    cta: "Start with the Dashboard",
  },
];
