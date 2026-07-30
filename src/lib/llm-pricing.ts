import "server-only";
import type { AnthropicUsage } from "@/lib/usage";

// $ per million tokens. These are Sonnet-tier rates as a starting point —
// confirm against https://www.anthropic.com/pricing before trusting this
// for real margin decisions, and update here if/when it changes. Cache
// writes cost more than a fresh input token, cache reads cost much less;
// that's why they're broken out rather than folded into input/output.
type ModelRates = { input: number; output: number; cacheWrite: number; cacheRead: number };

export const MODEL_RATES_PER_MILLION_TOKENS: Record<string, ModelRates> = {
  "claude-sonnet-5": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
};

const FALLBACK_RATE = MODEL_RATES_PER_MILLION_TOKENS["claude-sonnet-5"];

export function estimateCostUsd(
  model: string,
  tokens: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
  }
): number {
  const rate = MODEL_RATES_PER_MILLION_TOKENS[model] ?? FALLBACK_RATE;
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
    const cost = estimateCostUsd(row.model, {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_creation_tokens: usage.cache_creation_input_tokens ?? 0,
      cache_read_tokens: usage.cache_read_input_tokens ?? 0,
    });
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
    const cost = estimateCostUsd(row.model, {
      input_tokens: row.input_tokens,
      output_tokens: row.output_tokens,
      cache_creation_tokens: row.cache_creation_tokens,
      cache_read_tokens: row.cache_read_tokens,
    });
    const tokens = row.input_tokens + row.output_tokens + row.cache_creation_tokens + row.cache_read_tokens;
    const existing = totals.get(row.function_name) ?? { tokens: 0, costUsd: 0, calls: 0 };
    existing.tokens += tokens;
    existing.costUsd += cost;
    existing.calls += 1;
    totals.set(row.function_name, existing);
  }
  return totals;
}
