import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  CONNECT_MIN_BALANCE_TO_RUN_USD,
  chargeMicrosForCost,
  microsToUsd,
  usdToMicros,
} from "@/lib/connect-pricing";
import { applyToWallet } from "@/lib/wallet-ledger";

export { applyToWallet } from "@/lib/wallet-ledger";

type Admin = SupabaseClient<Database>;

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
