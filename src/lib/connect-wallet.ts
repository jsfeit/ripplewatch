import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  CONNECT_MIN_BALANCE_TO_RUN_USD,
  chargeMicrosForCost,
  microsToUsd,
  usdToMicros,
} from "@/lib/connect-pricing";

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

export async function getWalletBalanceMicros(supabase: Admin, accountId: string): Promise<number> {
  const { data } = await supabase.from("connect_wallets").select("balance_micros").eq("account_id", accountId).maybeSingle();
  return Number(data?.balance_micros ?? 0);
}

// Checked before running something that costs money. Requiring a small floor
// (not just "above zero") is what keeps the balance from going meaningfully
// negative when the call turns out to cost more than expected.
export async function hasMinimumBalance(supabase: Admin, accountId: string): Promise<{ ok: boolean; balanceUsd: number }> {
  const balance = await getWalletBalanceMicros(supabase, accountId);
  return { ok: balance >= usdToMicros(CONNECT_MIN_BALANCE_TO_RUN_USD), balanceUsd: microsToUsd(balance) };
}

// Charges a finished operation: what it cost us, plus the markup. Allowed to
// dip slightly below zero because the work already happened; the
// minimum-balance check beforehand bounds how far.
export async function chargeUsage(
  supabase: Admin,
  accountId: string,
  input: { ref: string; costUsd: number; description: string; meta?: Record<string, unknown> }
): Promise<{ chargedUsd: number; balanceUsd: number }> {
  const chargeMicros = chargeMicrosForCost(input.costUsd);
  if (chargeMicros === 0) {
    return { chargedUsd: 0, balanceUsd: microsToUsd(await getWalletBalanceMicros(supabase, accountId)) };
  }
  const result = await applyToWallet(supabase, accountId, {
    amountMicros: -chargeMicros,
    kind: "usage",
    ref: input.ref,
    description: input.description,
    meta: { costUsd: input.costUsd, ...input.meta },
    allowNegative: true,
  });
  return { chargedUsd: microsToUsd(chargeMicros), balanceUsd: microsToUsd(result.balanceMicros) };
}
