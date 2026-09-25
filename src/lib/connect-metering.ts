import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { runMetered } from "@/lib/usage-meter";
import { chargeUsage, hasMinimumBalance } from "@/lib/connect-wallet";
import { CONNECT_MIN_BALANCE_TO_RUN_USD } from "@/lib/connect-pricing";
import { maybeAutoReload } from "@/lib/connect-billing";
import { notifyIfLowBalance } from "@/lib/connect-notifications";

// LLM functions charged at the moment they run (see runMetered below) rather
// than folded into the daily usage charge, so one call is never charged twice.
export const INLINE_CHARGED_FUNCTIONS = ["answerQuestion"];

export type UsageNote = { charged_usd: number; wallet_balance_usd: number };

// Runs something that costs money for a Connect account. Refused below a
// minimum balance; afterward the wallet is charged what the call actually
// cost plus the markup, and an auto-reload is started if the balance is now
// low (off the request path when `schedule` is given). Non-Connect accounts
// (demo, comped, dashboard plans) run it without a charge.
export async function meteredForConnect<T>(
  input: { accountId: string; tier: string | undefined; toolName: string; schedule?: (fn: () => Promise<void>) => void },
  work: () => Promise<T>
): Promise<{ ok: true; value: T; usage: UsageNote | null } | { ok: false; message: string }> {
  if (input.tier !== "connect") return { ok: true, value: await work(), usage: null };

  const supabase = createAdminClient();
  const funds = await hasMinimumBalance(supabase, input.accountId);
  if (!funds.ok) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.ripplewatch.ai";
    return {
      ok: false,
      message: `Your Ripplewatch Connect balance is $${funds.balanceUsd.toFixed(2)}, below the $${CONNECT_MIN_BALANCE_TO_RUN_USD.toFixed(2)} needed to run this. Add funds at ${base}/app/settings?tab=connect to keep going.`,
    };
  }

  const { result: value, costUsd } = await runMetered(work);
  const charge = await chargeUsage(supabase, input.accountId, {
    ref: `call:${input.toolName}:${crypto.randomUUID()}`,
    costUsd,
    description: input.toolName === "ask" ? "Answer" : `Usage: ${input.toolName}`,
    meta: { tool: input.toolName },
  });

  const reload = async () => {
    await maybeAutoReload(supabase, input.accountId).catch((err) => console.error("auto-reload error:", err));
    await notifyIfLowBalance(supabase, input.accountId);
  };
  if (input.schedule) input.schedule(reload);
  else void reload();

  return {
    ok: true,
    value,
    usage: { charged_usd: Number(charge.chargedUsd.toFixed(4)), wallet_balance_usd: Number(charge.balanceUsd.toFixed(2)) },
  };
}
