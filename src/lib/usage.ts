import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AnthropicUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

// Fire-and-forget by design — a logging failure should never take down the
// scoring/suggestion/ask call it's recording. accountId is null for the
// onboarding-time suggestCompetitors call, which runs before an account
// exists; those calls simply aren't attributed to anything.
export function recordLlmUsage(
  accountId: string | null,
  functionName: string,
  model: string,
  usage: AnthropicUsage
): void {
  if (!accountId) return;

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
