import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/lib/llm-pricing";
import { addMeteredCost } from "@/lib/usage-meter";

export type AnthropicUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

// Fire-and-forget by design — a logging failure should never take down the
// scoring/suggestion/ask call it's recording. accountId is null for calls
// that run before an account exists (onboarding's suggestCompetitors, the
// public competitor snapshot). These used to be dropped entirely, which meant
// the only LLM spend anyone anonymous can trigger was also the only spend
// nobody could see or cap; they're now recorded with a null account_id (the
// per-account admin views all filter by account id, so they don't show up
// there, but countUnattributedLlmCalls below can see them).
export function recordLlmUsage(
  accountId: string | null,
  functionName: string,
  model: string,
  usage: AnthropicUsage
): void {
  // Also reported to any metered operation in progress (see usage-meter.ts),
  // so a prepaid Connect call can be charged what it actually cost.
  addMeteredCost(
    estimateCostUsd(
      model,
      {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_creation_tokens: usage.cache_creation_input_tokens ?? 0,
        cache_read_tokens: usage.cache_read_input_tokens ?? 0,
      },
      new Date().toISOString()
    )
  );

  createAdminClient()
    .from("llm_usage")
    .insert({
      account_id: accountId,
      function_name: functionName,
      model,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_creation_tokens: usage.cache_creation_input_tokens ?? 0,
      cache_read_tokens: usage.cache_read_input_tokens ?? 0,
    })
    .then(({ error }) => {
      if (error) console.error(`llm_usage insert failed for ${functionName}:`, error.message);
    });
}

// How many calls of one kind ran without an account in the last N hours.
// Backs the snapshot tool's daily cap. Returns null when the count can't be
// read, and callers should treat that as "allow" rather than break the
// feature over a bookkeeping failure.
export async function countUnattributedLlmCalls(functionName: string, hours: number): Promise<number | null> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { count, error } = await createAdminClient()
    .from("llm_usage")
    .select("id", { count: "exact", head: true })
    .is("account_id", null)
    .eq("function_name", functionName)
    .gte("created_at", since);
  if (error) {
    console.error(`llm_usage count failed for ${functionName}:`, error.message);
    return null;
  }
  return count ?? 0;
}
