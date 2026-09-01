import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, TIER_BY_PRICE } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPlanChangeEmail, sendPaymentReceivedEmail, sendReferralWelcomeEmail, sendReferralSignedUpEmail } from "@/lib/resend";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  const supabase = createAdminClient();

  // A caught DB error here used to be swallowed silently, with the route
  // still returning 200 — Stripe would never retry, so a transient DB
  // failure meant a customer got charged but never provisioned, with
  // nothing surfacing anywhere. Any write failure below now throws, which
  // both trips the catch-all at the bottom (500, so Stripe retries the
  // event) and gets picked up by Sentry's route instrumentation.
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const accountId = session.metadata?.account_id ?? session.client_reference_id;
        const tier = session.metadata?.tier;
        if (accountId && tier) {
          const { error } = await supabase
            .from("accounts")
            .update({
              stripe_customer_id: String(session.customer),
              stripe_subscription_id: String(session.subscription),
              tier: tier as "starter" | "plus" | "advanced",
            })
            .eq("id", accountId);
          if (error) throw new Error(`checkout.session.completed account update failed: ${error.message}`);

          // Best-effort, fire-and-forget — a referral notification failing
          // shouldn't fail the webhook (Stripe would retry the whole event,
          // re-running the account update above pointlessly).
          const { data: referredAccount } = await supabase
            .from("accounts")
            .select("name, contact_email, referred_by_account_id")
            .eq("id", accountId)
            .single();
          if (referredAccount?.referred_by_account_id) {
            const { data: referrerAccount } = await supabase
              .from("accounts")
              .select("name, contact_email")
              .eq("id", referredAccount.referred_by_account_id)
              .single();
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
            if (referredAccount.contact_email && referrerAccount?.name) {
              sendReferralWelcomeEmail(referredAccount.contact_email, referredAccount.name, referrerAccount.name, appUrl).catch(
                (err) => console.error("referral welcome email failed:", err)
              );
            }
            if (referrerAccount?.contact_email) {
              sendReferralSignedUpEmail(referrerAccount.contact_email, referrerAccount.name, referredAccount.name).catch(
                (err) => console.error("referral signed-up email failed:", err)
              );
            }
          }
        }
        break;
      }

      // Fires right after checkout — the initial tier/status write. No email
      // here; the welcome email already covers a brand-new signup.
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const accountId = subscription.metadata?.account_id;
        const priceId = subscription.items.data[0]?.price.id;
        const tier = priceId ? TIER_BY_PRICE[priceId] : undefined;
        // priceId not mapping to a known tier means TIER_BY_PRICE (env-var
        // driven) is out of sync with what's actually configured in
        // Stripe — a config problem no retry fixes on its own, but it
        // should never fail silently: subscription_status still gets
        // written (best effort), and this throws afterward so the gap is
        // visible instead of quietly leaving the account on a stale tier.
        if (priceId && !tier) {
          console.error(`customer.subscription.created: no tier mapped for price ${priceId} (account ${accountId})`);
        }
        if (accountId) {
          const { error } = await supabase
            .from("accounts")
            .update({ ...(tier ? { tier } : {}), subscription_status: subscription.status })
            .eq("id", accountId);
          if (error) throw new Error(`customer.subscription.created account update failed: ${error.message}`);
        }
        if (priceId && !tier) {
          throw new Error(`No tier mapped for Stripe price ${priceId} — check TIER_BY_PRICE / price env vars.`);
        }
        break;
      }

      // Fires on any later plan/status change — the single source of truth
      // for both tier and subscription health, since it carries Stripe's
      // actual .status rather than us inferring it. Emails the account only
      // when the tier itself actually moved (comparing against what was on
      // the row before this update), not on every status ping.
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const accountId = subscription.metadata?.account_id;
        const priceId = subscription.items.data[0]?.price.id;
        const tier = priceId ? TIER_BY_PRICE[priceId] : undefined;
        if (priceId && !tier) {
          console.error(`customer.subscription.updated: no tier mapped for price ${priceId} (account ${accountId})`);
        }
        if (accountId) {
          const { data: existing } = await supabase
            .from("accounts")
            .select("tier, contact_email")
            .eq("id", accountId)
            .single();

          const { error } = await supabase
            .from("accounts")
            .update({ ...(tier ? { tier } : {}), subscription_status: subscription.status })
            .eq("id", accountId);
          if (error) throw new Error(`customer.subscription.updated account update failed: ${error.message}`);

          if (tier && existing && existing.tier !== tier && existing.contact_email) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
            sendPlanChangeEmail(existing.contact_email, existing.tier, tier, appUrl).catch((err) =>
              console.error("plan-change email failed:", err)
            );
          }
        }
        if (priceId && !tier) {
          throw new Error(`No tier mapped for Stripe price ${priceId} — check TIER_BY_PRICE / price env vars.`);
        }
        break;
      }

      // Every actual charge lands here — the first payment on a brand-new
      // subscription and every recurring renewal alike, since renewals bill
      // through an invoice with no new Checkout Session (checkout.session.
      // completed only ever fires once). amount_paid === 0 is a fully-
      // discounted or $0-proration invoice, not a real payment, so it's
      // skipped rather than emailing "you got paid $0.00."
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (customerId && invoice.amount_paid > 0) {
          const { data: account } = await supabase
            .from("accounts")
            .select("name, tier")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();

          const adminEmails = (process.env.ADMIN_EMAILS ?? "")
            .split(",")
            .map((email) => email.trim())
            .filter(Boolean);
          if (adminEmails.length > 0) {
            sendPaymentReceivedEmail(adminEmails, {
              accountName: account?.name ?? "Unknown account",
              tier: account?.tier ?? "unknown",
              amountUsd: invoice.amount_paid / 100,
              currency: invoice.currency,
            }).catch((err) => console.error("payment-received email failed:", err));
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const accountId = subscription.metadata?.account_id;
        if (accountId) {
          const { error } = await supabase
            .from("accounts")
            .update({ tier: "starter", stripe_subscription_id: null, subscription_status: "canceled" })
            .eq("id", accountId);
          if (error) throw new Error(`customer.subscription.deleted account update failed: ${error.message}`);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`stripe webhook handler failed for ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
