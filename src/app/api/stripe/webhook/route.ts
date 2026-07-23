import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, TIER_BY_PRICE } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

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

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const accountId = session.metadata?.account_id ?? session.client_reference_id;
      const tier = session.metadata?.tier;
      if (accountId && tier) {
        await supabase
          .from("accounts")
          .update({
            stripe_customer_id: String(session.customer),
            stripe_subscription_id: String(session.subscription),
            tier: tier as "starter" | "plus",
          })
          .eq("id", accountId);
      }
      break;
    }

    // Fires right after checkout, and again on any plan/status change — the
    // single source of truth for both tier and subscription health, since
    // it carries Stripe's actual .status rather than us inferring it.
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const accountId = subscription.metadata?.account_id;
      const priceId = subscription.items.data[0]?.price.id;
      const tier = priceId ? TIER_BY_PRICE[priceId] : undefined;
      if (accountId) {
        await supabase
          .from("accounts")
          .update({ ...(tier ? { tier } : {}), subscription_status: subscription.status })
          .eq("id", accountId);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const accountId = subscription.metadata?.account_id;
      if (accountId) {
        await supabase
          .from("accounts")
          .update({ tier: "starter", stripe_subscription_id: null, subscription_status: "canceled" })
          .eq("id", accountId);
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
