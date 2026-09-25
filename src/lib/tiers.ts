import { MONTHLY_PRICE_USD, annualPriceUsd, ANNUAL_DISCOUNT_PERCENT } from "./pricing";

export type TierId = "starter" | "plus";

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
  highlight?: boolean;
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
    id: "starter",
    name: "Starter",
    price: `$${MONTHLY_PRICE_USD.starter}`,
    priceNote: "/mo",
    annualNote: annualNote(MONTHLY_PRICE_USD.starter),
    monthlyUsd: MONTHLY_PRICE_USD.starter,
    selfServe: true,
    tagline: "Track your 3 biggest competitors, full Momentum included.",
    competitors: "3 competitors",
    signalSources: "Pricing, job postings, news, funding, product changes",
    relevanceScoring: "Full scoring + Momentum score",
    delivery: "Slack + email",
    seats: "3 logins",
    cta: "Start with Starter",
  },
  {
    id: "plus",
    name: "Plus",
    price: `$${MONTHLY_PRICE_USD.plus}`,
    priceNote: "/mo",
    annualNote: annualNote(MONTHLY_PRICE_USD.plus),
    monthlyUsd: MONTHLY_PRICE_USD.plus,
    selfServe: true,
    tagline: "Everything in Starter, on up to 20 competitors, plus HubSpot, call insights, API access, and a guided setup.",
    competitors: "Up to 20 competitors",
    signalSources: "Pricing, job postings, news, funding, product changes",
    relevanceScoring: "Full scoring + Momentum score",
    onboarding: "Onboarding support",
    delivery: "Slack + email",
    crm: "HubSpot (read-only pull)",
    callIntel: "Zoom call insights",
    gong: "Gong (coming soon)",
    intercom: "Intercom (coming soon)",
    apiAccess: "Read-only API + Claude and ChatGPT connector",
    visualDiff: "Visual change detection",
    seats: "Unlimited",
    cta: "Start with Plus",
    highlight: true,
  },
];
