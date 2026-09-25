import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Admin = SupabaseClient<Database>;

export type WalletApplyResult = { applied: boolean; balanceMicros: number };

// The single entry point for changing a wallet balance. Everything goes
// through the connect_wallet_apply database function, which is atomic and
// idempotent on `ref` (see migration 0076): retrying the same funding webhook
// or usage charge can't double-apply.
export async function applyToWallet(
  supabase: Admin,
  accountId: string,
  input: {
    amountMicros: number;
    kind: "funding" | "usage" | "refund" | "adjustment";
    ref: string;
    description?: string;
    meta?: Record<string, unknown>;
    // Only for the small overrun of a call that already ran; see
    // hasMinimumBalance for what bounds it.
    allowNegative?: boolean;
  }
): Promise<WalletApplyResult> {
  const { data, error } = await supabase.rpc("connect_wallet_apply", {
    p_account_id: accountId,
    p_amount_micros: input.amountMicros,
    p_kind: input.kind,
    p_ref: input.ref,
    p_description: input.description ?? null,
    p_meta: input.meta ?? null,
    p_allow_negative: input.allowNegative ?? false,
  });
  if (error || !data?.[0]) throw new Error(`wallet apply failed: ${error?.message ?? "no result"}`);
  return { applied: data[0].applied, balanceMicros: Number(data[0].balance_micros) };
}
