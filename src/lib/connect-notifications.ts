import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { CONNECT_MIN_BALANCE_TO_RUN_USD, microsToUsd, usdToMicros } from "@/lib/connect-pricing";
import { sendConnectLowBalanceEmail, sendConnectReloadFailedEmail } from "@/lib/resend";

type Admin = SupabaseClient<Database>;

const LOW_BALANCE_USD = 5;
const LOW_BALANCE_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://www.ripplewatch.ai";

// One send per key per cooldown, using the same system_alerts table the other
// throttled alerts use. Two callers racing could both send once; that's an
// accepted cost of not needing a migration for a notification.
async function claimAlertSlot(supabase: Admin, key: string, cooldownMs: number): Promise<boolean> {
  const { data: existing } = await supabase.from("system_alerts").select("last_sent_at").eq("key", key).maybeSingle();
  if (existing && Date.now() - new Date(existing.last_sent_at).getTime() < cooldownMs) return false;
  await supabase.from("system_alerts").upsert({ key, last_sent_at: new Date().toISOString() }, { onConflict: "key" });
  return true;
}

async function contactFor(supabase: Admin, accountId: string) {
  const { data } = await supabase.from("accounts").select("name, contact_email, tier, status").eq("id", accountId).single();
  return data && data.tier === "connect" && data.contact_email ? { name: data.name, email: data.contact_email, active: data.status === "active" } : null;
}

// Auto-reload just failed and switched itself off. Sent once by construction:
// reload stays off until the customer turns it back on.
export async function notifyReloadFailed(supabase: Admin, accountId: string): Promise<void> {
  try {
    const contact = await contactFor(supabase, accountId);
    if (contact) await sendConnectReloadFailedEmail(contact.email, contact.name, appUrl());
  } catch (err) {
    console.error("reload-failed email failed:", err);
  }
}

// Emails when the balance is low AND nothing will top it up (auto-reload off
// or failed). With a working auto-reload there's nothing for the customer to do,
// so no email. Throttled to one per few days per account.
export async function notifyIfLowBalance(supabase: Admin, accountId: string): Promise<void> {
  try {
    const [{ data: wallet }, contact] = await Promise.all([
      supabase.from("connect_wallets").select("balance_micros, auto_reload_enabled, reload_failed_at").eq("account_id", accountId).maybeSingle(),
      contactFor(supabase, accountId),
    ]);
    if (!wallet || !contact || !contact.active) return;
    if (wallet.auto_reload_enabled && !wallet.reload_failed_at) return;

    const balance = Number(wallet.balance_micros);
    if (balance >= usdToMicros(LOW_BALANCE_USD)) return;
    if (!(await claimAlertSlot(supabase, `connect-low:${accountId}`, LOW_BALANCE_COOLDOWN_MS))) return;

    const paused = balance < usdToMicros(CONNECT_MIN_BALANCE_TO_RUN_USD);
    await sendConnectLowBalanceEmail(contact.email, contact.name, microsToUsd(balance), paused, appUrl());
  } catch (err) {
    console.error("low-balance email failed:", err);
  }
}

// Exposed for the dispute alert, which throttles per dispute.
export { claimAlertSlot };
