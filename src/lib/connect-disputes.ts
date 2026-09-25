import "server-only";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getStripe } from "@/lib/stripe";
import { sendDisputeAlertEmail } from "@/lib/resend";
import { claimAlertSlot } from "@/lib/connect-notifications";

type Admin = SupabaseClient<Database>;

// A customer disputed a charge. Always tells the admins (a dispute has a
// response deadline and can claw back money). If the disputed customer is a
// Ripplewatch Connect account it is also frozen: put on hold and auto-reload
// switched off, so no more of a possibly-clawed-back balance is spent or added
// while it's sorted out. It is NOT unfrozen automatically when a dispute is
// won: that stays a human decision.
export async function handleDispute(supabase: Admin, dispute: Stripe.Dispute): Promise<void> {
  // One alert per dispute even if the webhook is redelivered.
  if (!(await claimAlertSlot(supabase, `dispute:${dispute.id}`, 90 * 24 * 60 * 60 * 1000))) return;

  let customerId: string | null = null;
  try {
    const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
    if (chargeId) {
      const charge = await getStripe().charges.retrieve(chargeId);
      customerId = typeof charge.customer === "string" ? charge.customer : (charge.customer?.id ?? null);
    }
  } catch (err) {
    console.error("dispute: couldn't look up the charge's customer:", err instanceof Error ? err.message : err);
  }

  let accountName: string | null = null;
  let froze = false;
  let walletBalanceUsd: number | null = null;

  if (customerId) {
    const { data: account } = await supabase
      .from("accounts")
      .select("id, name, tier")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (account) {
      accountName = account.name;
      if (account.tier === "connect") {
        await supabase.from("accounts").update({ status: "hold" }).eq("id", account.id);
        await supabase
          .from("connect_wallets")
          .upsert(
            { account_id: account.id, auto_reload_enabled: false, reload_failed_at: new Date().toISOString() },
            { onConflict: "account_id" }
          );
        const { data: wallet } = await supabase.from("connect_wallets").select("balance_micros").eq("account_id", account.id).maybeSingle();
        walletBalanceUsd = Number(wallet?.balance_micros ?? 0) / 1_000_000;
        froze = true;
      }
    }
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
  await sendDisputeAlertEmail(adminEmails, {
    disputeId: dispute.id,
    amountUsd: dispute.amount / 100,
    reason: dispute.reason,
    accountName,
    froze,
    walletBalanceUsd,
  });
}
