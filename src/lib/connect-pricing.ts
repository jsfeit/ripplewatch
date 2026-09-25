// Ripplewatch Connect pricing. One file so the site, checkout and the
// metering code read the same numbers, and a price change is an edit here.
//
// The model: a flat monthly platform fee, plus prepaid usage. Everything that
// costs real money to serve (answers, monitoring a competitor) is charged from
// a wallet the customer funds up front, at actual cost plus a markup. Credits
// are only added after a payment succeeds, and usage stops at a zero balance,
// so there's never usage on credit.

export const CONNECT_BASE_FEE_USD = 29;

// Charged on top of what a call actually cost us (LLM tokens at the model's
// list rate). 0.5 = cost plus 50%. Measured LLM cost is small (roughly $0.20
// to $0.80 per tracked competitor per month, cents per answer), so at this
// markup usage revenue is modest and the base fee carries the margin.
export const CONNECT_USAGE_MARKUP = 0.5;

// Covers what isn't in the LLM bill for keeping a competitor watched (page
// fetches, screenshots, hosting), charged per competitor per day of
// monitoring. A placeholder until that cost is measured properly.
export const CONNECT_MONITORING_FEE_PER_COMPETITOR_DAY_USD = 0.02;

// Wallet funding. Reloads start at $50: smaller amounts make card fees a
// noticeable share of what's bought.
export const CONNECT_FUNDING_OPTIONS_USD = [50, 100, 250] as const;
export const CONNECT_MIN_FUNDING_USD = 50;
export const CONNECT_DEFAULT_RELOAD_USD = 50;
// Auto-reload triggers when the balance drops below this.
export const CONNECT_DEFAULT_RELOAD_THRESHOLD_USD = 10;

// A call is refused unless the wallet holds at least this much, so the last
// call before a top-up can't push the balance meaningfully below zero.
export const CONNECT_MIN_BALANCE_TO_RUN_USD = 0.5;

const MICROS_PER_USD = 1_000_000;

export const usdToMicros = (usd: number): number => Math.round(usd * MICROS_PER_USD);
export const microsToUsd = (micros: number): number => micros / MICROS_PER_USD;

// What the customer is charged for something that cost us `costUsd`.
export function chargeMicrosForCost(costUsd: number): number {
  return Math.max(0, Math.round(costUsd * (1 + CONNECT_USAGE_MARKUP) * MICROS_PER_USD));
}
