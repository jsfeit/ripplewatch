import { MONTHLY_PRICE_USD, annualPriceUsd, ANNUAL_DISCOUNT_PERCENT } from "./pricing";

export type TierId = "starter" | "plus" | "advanced";

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
  onboarding: string;
  delivery: string;
  crm: string;
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
    tagline: "Get the signal, see the difference relevance makes.",
    competitors: "3 competitors",
    signalSources: "Pricing, job postings, news, funding",
    relevanceScoring: "1 fully-scored alert/week (teaser) — rest raw & unscored",
    onboarding: "Self-serve form",
    delivery: "Slack + email",
    crm: "Read-only pull",
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
    tagline: "Everything in Starter, full scoring, on up to 7 competitors.",
    competitors: "Up to 7 competitors",
    signalSources: "Pricing, job postings, news, funding",
    relevanceScoring: "Full scoring on every signal",
    onboarding: "Self-serve form",
    delivery: "Slack + email",
    crm: "Read-only pull",
    seats: "Up to 10 seats",
    cta: "Start with Plus",
    highlight: true,
  },
  {
    id: "advanced",
    name: "Advanced",
    price: `$${MONTHLY_PRICE_USD.advanced}`,
    priceNote: "/mo",
    annualNote: annualNote(MONTHLY_PRICE_USD.advanced),
    monthlyUsd: MONTHLY_PRICE_USD.advanced,
    selfServe: true,
    tagline: "Everything in Plus, with more room and a guided setup.",
    competitors: "Up to 20 competitors",
    signalSources: "Pricing, job postings, news, funding",
    relevanceScoring: "Full scoring on every signal",
    onboarding: "Assisted onboarding call",
    delivery: "Slack + email",
    crm: "Read-only pull",
    seats: "Unlimited",
    cta: "Start with Advanced",
  },
];
