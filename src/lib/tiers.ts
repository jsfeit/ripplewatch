import { MONTHLY_PRICE_USD, annualPriceUsd, ANNUAL_DISCOUNT_PERCENT } from "./pricing";

export type TierId = "starter" | "plus" | "plus-human";

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
    tagline: "Everything in Starter, full scoring, on up to 15 competitors.",
    competitors: "Up to 15 competitors",
    signalSources: "Pricing, job postings, news, funding",
    relevanceScoring: "Full scoring on every signal",
    onboarding: "Self-serve form",
    delivery: "Slack + email",
    crm: "Read-only pull",
    seats: "Unlimited",
    cta: "Start with Plus",
    highlight: true,
  },
  {
    id: "plus-human",
    name: "Plus + Human",
    price: `$${MONTHLY_PRICE_USD.plus_human}`,
    priceNote: "/mo",
    annualNote: annualNote(MONTHLY_PRICE_USD.plus_human),
    monthlyUsd: MONTHLY_PRICE_USD.plus_human,
    selfServe: false,
    tagline: "Everything in Plus, with an analyst tuning your context.",
    competitors: "Up to 15 competitors",
    signalSources: "Pricing, job postings, news, funding",
    relevanceScoring: "Full + analyst-refined",
    onboarding: "Analyst-led call",
    delivery: "Slack + email + monthly brief",
    crm: "Read-only pull",
    seats: "Unlimited",
    cta: "Talk to us",
  },
];
