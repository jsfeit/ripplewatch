import "server-only";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getStripe, getConnectPriceId } from "@/lib/stripe";
import { PRODUCT_TAX_CODE } from "@/lib/pricing";
import { CONNECT_FUNDING_OPTIONS_USD, CONNECT_MIN_FUNDING_USD, usdToMicros } from "@/lib/connect-pricing";
import { applyToWallet } from "@/lib/wallet-ledger";

type Admin = SupabaseClient<Database>;

// The funding amounts a customer can choose, plus any larger whole-dollar
// amount for someone who wants a bigger balance. Validated here (not trusted
// from the client) because this number is exactly how many credits get added.
const MAX_FUNDING_USD = 10_000;
export function parseFundingUsd(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < CONNECT_MIN_FUNDING_USD || n > MAX_FUNDING_USD) return null;
  return n;
}
export const FUNDING_PRESETS_USD = CONNECT_FUNDING_OPTIONS_USD;

// Line item for a wallet funding amount. Carries a tax code because it's taxed
// like the platform fee (credits are prepaid software usage).
function fundingLineItem(fundingUsd: number): Stripe.Checkout.SessionCreateParams.LineItem {
  return {
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: fundingUsd * 100,
      tax_behavior: "exclusive",
      product_data: {
        name: "Ripplewatch Connect usage balance",
        description: "Prepaid balance for answers and competitor monitoring. Non-refundable once used.",
        tax_code: PRODUCT_TAX_CODE,
      },
    },
  };
}

export type ConnectAccountRow = {
  id: string;
  stripe_customer_id: string | null;
  contact_email: string | null;
  tier: string;
  demo_mode: boolean;
};

// Discounts and promo codes are deliberately off for Connect checkouts: a
// percent-off code applies to every line, including the wallet funding, which
// would hand out free credits (credit amount is the full funding figure).
export async function createConnectSignupSession(
  account: ConnectAccountRow,
  input: { fundingUsd: number; userEmail: string; origin: string }
): Promise<{ clientSecret: string }> {
  const priceId = getConnectPriceId();
  if (!priceId) throw new Error("STRIPE_PRICE_CONNECT is not configured.");

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    ui_mode: "embedded_page",
    customer: account.stripe_customer_id ?? undefined,
    customer_email: account.stripe_customer_id ? undefined : input.userEmail,
    client_reference_id: account.id,
    line_items: [{ price: priceId, quantity: 1 }, fundingLineItem(input.fundingUsd)],
    automatic_tax: { enabled: true },
    metadata: {
      account_id: account.id,
      tier: "connect",
      purpose: "connect_signup",
      funding_cents: String(input.fundingUsd * 100),
    },
    subscription_data: { metadata: { account_id: account.id, tier: "connect" } },
    return_url: `${input.origin}/app/settings?tab=connect&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
  });
  if (!session.client_secret) throw new Error("Stripe returned no client secret.");
  return { clientSecret: session.client_secret };
}

// Adding funds later, from Settings. Saves the card for off-session use so
// auto-reload can charge it.
export async function createConnectTopupSession(
  account: ConnectAccountRow,
  input: { fundingUsd: number; origin: string }
): Promise<{ clientSecret: string }> {
  if (!account.stripe_customer_id) throw new Error("No billing customer yet.");

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    ui_mode: "embedded_page",
    customer: account.stripe_customer_id,
    client_reference_id: account.id,
    line_items: [fundingLineItem(input.fundingUsd)],
    automatic_tax: { enabled: true },
    invoice_creation: { enabled: true },
    payment_intent_data: { setup_future_usage: "off_session" },
    metadata: {
      account_id: account.id,
      purpose: "connect_topup",
      funding_cents: String(input.fundingUsd * 100),
    },
    return_url: `${input.origin}/app/settings?tab=connect&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
  });
  if (!session.client_secret) throw new Error("Stripe returned no client secret.");
  return { clientSecret: session.client_secret };
}

// Turns a paid Connect checkout into wallet credit. The amount comes from
// metadata this server wrote when it created the session (never from the
// client), it only runs once Stripe reports the session paid, and the
// checkout session id is the idempotency key, so a redelivered webhook can't
// credit twice.
export async function creditWalletFromCheckout(
  supabase: Admin,
  session: Stripe.Checkout.Session
): Promise<{ credited: boolean; reason?: string }> {
  const purpose = session.metadata?.purpose;
  if (purpose !== "connect_signup" && purpose !== "connect_topup") return { credited: false, reason: "not a connect session" };
  if (session.payment_status !== "paid") return { credited: false, reason: `payment_status ${session.payment_status}` };

  const accountId = session.metadata?.account_id;
  const fundingCents = Number(session.metadata?.funding_cents);
  if (!accountId || !Number.isInteger(fundingCents) || fundingCents < CONNECT_MIN_FUNDING_USD * 100) {
    throw new Error(`connect checkout ${session.id} has invalid metadata`);
  }

  const result = await applyToWallet(supabase, accountId, {
    amountMicros: usdToMicros(fundingCents / 100),
    kind: "funding",
    ref: `checkout:${session.id}`,
    description: purpose === "connect_signup" ? "Initial balance" : "Added funds",
    meta: { checkoutSessionId: session.id, purpose },
  });
  return { credited: result.applied };
}

// After the first Connect checkout: make the card the customer just used the
// default for invoices, so a later auto-reload can charge it without them.
export async function saveDefaultPaymentMethod(session: Stripe.Checkout.Session): Promise<void> {
  const stripe = getStripe();
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!subscriptionId || !customerId) return;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const pm =
    typeof subscription.default_payment_method === "string"
      ? subscription.default_payment_method
      : subscription.default_payment_method?.id;
  if (pm) await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pm } });
}

// ---------------------------------------------------------------------------
// Auto-reload
// ---------------------------------------------------------------------------

// Credits the wallet for a paid reload invoice. Same guarantees as the
// checkout path: amount from metadata this server wrote, only when Stripe says
// the invoice is paid, and the invoice id is the idempotency key. Called both
// right after the charge succeeds (so the balance is usable immediately) and
// from the invoice.paid webhook (in case the first call never got to run).
export async function creditWalletFromReloadInvoice(
  supabase: Admin,
  invoice: Stripe.Invoice
): Promise<{ credited: boolean }> {
  if (invoice.metadata?.purpose !== "connect_reload" || invoice.status !== "paid") return { credited: false };
  const accountId = invoice.metadata.account_id;
  const fundingCents = Number(invoice.metadata.funding_cents);
  if (!accountId || !Number.isInteger(fundingCents) || fundingCents < CONNECT_MIN_FUNDING_USD * 100) {
    throw new Error(`reload invoice ${invoice.id} has invalid metadata`);
  }
  const result = await applyToWallet(supabase, accountId, {
    amountMicros: usdToMicros(fundingCents / 100),
    kind: "funding",
    ref: `invoice:${invoice.id}`,
    description: "Auto-reload",
    meta: { invoiceId: invoice.id, purpose: "connect_reload" },
  });
  return { credited: result.applied };
}

// If the balance has dropped below the account's threshold, charge the saved
// card for the reload amount. Safe to call after every charge: an atomic claim
// (connect_wallet_claim_reload) lets exactly one caller through, and only when
// a reload is actually due. Credits are added only after the payment succeeds.
// A declined card switches auto-reload off (the customer sees why in Settings)
// rather than retrying, so a bad card can't loop.
export async function maybeAutoReload(supabase: Admin, accountId: string): Promise<void> {
  const { data: claimed, error: claimError } = await supabase.rpc("connect_wallet_claim_reload", { p_account_id: accountId });
  if (claimError) {
    console.error("connect reload claim failed:", claimError.message);
    return;
  }
  if (!claimed) return;

  const releaseClaim = () =>
    supabase.from("connect_wallets").update({ reload_started_at: null }).eq("account_id", accountId).then(() => undefined);

  try {
    const [{ data: wallet }, { data: account }] = await Promise.all([
      supabase.from("connect_wallets").select("reload_amount_cents").eq("account_id", accountId).single(),
      supabase.from("accounts").select("stripe_customer_id, tier, status").eq("id", accountId).single(),
    ]);
    if (!wallet || !account?.stripe_customer_id || account.tier !== "connect" || account.status !== "active") return;

    const stripe = getStripe();
    const cents = wallet.reload_amount_cents;
    let invoice: Stripe.Invoice | null = null;
    try {
      await stripe.invoiceItems.create({
        customer: account.stripe_customer_id,
        amount: cents,
        currency: "usd",
        description: "Ripplewatch Connect usage balance reload",
        tax_behavior: "exclusive",
        tax_code: PRODUCT_TAX_CODE,
      });
      invoice = await stripe.invoices.create({
        customer: account.stripe_customer_id,
        collection_method: "charge_automatically",
        auto_advance: false,
        automatic_tax: { enabled: true },
        pending_invoice_items_behavior: "include",
        metadata: { account_id: accountId, purpose: "connect_reload", funding_cents: String(cents) },
      });
      const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
      const paid = await stripe.invoices.pay(finalized.id);
      await creditWalletFromReloadInvoice(supabase, paid);
    } catch (err) {
      console.error(`connect auto-reload failed for ${accountId}:`, err instanceof Error ? err.message : err);
      // Don't leave an open invoice that Stripe might keep retrying.
      if (invoice) await stripe.invoices.voidInvoice(invoice.id).catch(() => undefined);
      await supabase
        .from("connect_wallets")
        .update({ auto_reload_enabled: false, reload_failed_at: new Date().toISOString() })
        .eq("account_id", accountId);
    }
  } finally {
    await releaseClaim();
  }
}
