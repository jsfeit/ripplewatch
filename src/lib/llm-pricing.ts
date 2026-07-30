import "server-only";
import type { AnthropicUsage } from "@/lib/usage";

// $ per million tokens, from https://docs.anthropic.com/en/docs/about-claude/pricing
// (checked 2026-07-30). cacheWrite is the 5-minute/ephemeral write multiplier — the
// only cache TTL this app uses (see `cache_control: { type: "ephemeral" }` in
// src/lib/anthropic.ts) — not the pricier 1-hour write rate.
type ModelRates = { input: number; output: number; cacheWrite: number; cacheRead: number };

// Claude Sonnet 5 has introductory pricing through 2026-08-31, then standard
// pricing takes effect 2026-09-01. Both tiers are captured here, keyed by the
// date they took effect, so a call's cost is estimated at whichever rate was
// actually in force when it ran — no manual edit needed when the rate flips.
type RateSchedule = { effectiveFrom: string; rates: ModelRates }[];

const RATE_SCHEDULES: Record<string, RateSchedule> = {
  "claude-sonnet-5": [
    { effectiveFrom: "2000-01-01", rates: { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 } },
    { effectiveFrom: "2026-09-01", rates: { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 } },
  ],
};

const FALLBACK_SCHEDULE = RATE_SCHEDULES["claude-sonnet-5"];

function ratesFor(model: string, atIso: string): ModelRates {
  const schedule = RATE_SCHEDULES[model] ?? FALLBACK_SCHEDULE;
  let chosen = schedule[0];
  for (const entry of schedule) {
    if (entry.effectiveFrom <= atIso) chosen = entry;
  }
  return chosen.rates;
}

export function estimateCostUsd(
  model: string,
  tokens: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
  },
  atIso: string
): number {
  const rate = ratesFor(model, atIso);
  return (
    (tokens.input_tokens * rate.input +
      tokens.output_tokens * rate.output +
      tokens.cache_creation_tokens * rate.cacheWrite +
      tokens.cache_read_tokens * rate.cacheRead) /
    1_000_000
  );
}

export type LlmUsageRow = {
  account_id: string | null;
  function_name: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  created_at: string;
};

export type AccountLlmTotals = { tokens: number; costUsd: number; calls: number };

// Shared by the accounts list (all accounts, one pass) and the account
// detail page (single account, broken down by function) so the two views
// can't drift on what counts as a "token" or how cost is estimated.
export function sumLlmUsageByAccount(rows: LlmUsageRow[]): Map<string, AccountLlmTotals> {
  const totals = new Map<string, AccountLlmTotals>();
  for (const row of rows) {
    if (!row.account_id) continue;
    const usage: AnthropicUsage = {
      input_tokens: row.input_tokens,
      output_tokens: row.output_tokens,
      cache_creation_input_tokens: row.cache_creation_tokens,
      cache_read_input_tokens: row.cache_read_tokens,
    };
    const cost = estimateCostUsd(
      row.model,
      {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_creation_tokens: usage.cache_creation_input_tokens ?? 0,
        cache_read_tokens: usage.cache_read_input_tokens ?? 0,
      },
      row.created_at
    );
    const tokens = row.input_tokens + row.output_tokens + row.cache_creation_tokens + row.cache_read_tokens;
    const existing = totals.get(row.account_id) ?? { tokens: 0, costUsd: 0, calls: 0 };
    existing.tokens += tokens;
    existing.costUsd += cost;
    existing.calls += 1;
    totals.set(row.account_id, existing);
  }
  return totals;
}

export function sumLlmUsageByFunction(rows: LlmUsageRow[]): Map<string, AccountLlmTotals> {
  const totals = new Map<string, AccountLlmTotals>();
  for (const row of rows) {
    const cost = estimateCostUsd(
      row.model,
      {
        input_tokens: row.input_tokens,
        output_tokens: row.output_tokens,
        cache_creation_tokens: row.cache_creation_tokens,
        cache_read_tokens: row.cache_read_tokens,
      },
      row.created_at
    );
    const tokens = row.input_tokens + row.output_tokens + row.cache_creation_tokens + row.cache_read_tokens;
    const existing = totals.get(row.function_name) ?? { tokens: 0, costUsd: 0, calls: 0 };
    existing.tokens += tokens;
    existing.costUsd += cost;
    existing.calls += 1;
    totals.set(row.function_name, existing);
  }
  return totals;
}
