import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { sendReferralRewardEmail } from "@/lib/resend";

const DAY_MS = 24 * 60 * 60 * 1000;
const QUALIFY_AFTER_MS = 60 * DAY_MS;

// Live by default is deliberately opt-in — this is the one cron in the
// codebase that reaches into a real customer's Stripe subscription and
// changes what they're charged. Unset (or anything other than "true"),
// it computes and logs exactly what it *would* do, without calling
// stripe.subscriptions.update or marking the referral qualified — so a
// dry run today doesn't cost the real run anything once this is flipped
// on. Flip via the REFERRAL_REWARDS_LIVE env var on Vercel after
// reviewing a few of these log lines in production.
const LIVE = process.env.REFERRAL_REWARDS_LIVE === "true";

// Runs once a day. Every successful referral (the referred account has
// stayed active/paying for 60 days — see the "referred account currently
// active" check below) grants the referrer 2 more free months (monthly) or
// ~2/12 off their next renewal (annual), stacking with any prior
// successful referrals. Deliberately a point-in-time check at the 60-day
// mark rather than a full continuous-activity ledger, matching how
// payment-reminders already does simple age-threshold checks.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const now = Date.now();

  const { data: pending } = await supabase
    .from("referrals")
    .select("id, referrer_account_id, referred_account_id, referred_at")
    .is("qualified_at", null);

  const summary: Record<string, unknown>[] = [];

  for (const referral of pending ?? []) {
    const ageMs = now - new Date(referral.referred_at).getTime();
    if (ageMs < QUALIFY_AFTER_MS) continue;

    const { data: referred } = await supabase
      .from("accounts")
      .select("name, status, subscription_status")
      .eq("id", referral.referred_account_id)
      .single();
    if (!referred || referred.status !== "active" || referred.subscription_status !== "active") {
      summary.push({ referralId: referral.id, qualified: false, reason: "referred account not active" });
      continue;
    }

    const { data: referrer } = await supabase
      .from("accounts")
      .select("name, contact_email, stripe_subscription_id")
      .eq("id", referral.referrer_account_id)
      .single();
    if (!referrer?.stripe_subscription_id) {
      summary.push({ referralId: referral.id, qualified: false, reason: "referrer has no active subscription" });
      continue;
    }

    // Cumulative count including this one, so the reward reflects every
    // successful referral this account has ever sent, not just this one.
    const { count: priorQualified } = await supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_account_id", referral.referrer_account_id)
      .not("qualified_at", "is", null);
    const qualifiedCount = (priorQualified ?? 0) + 1;

    try {
      const subscription = await getStripe().subscriptions.retrieve(referrer.stripe_subscription_id);
      const interval = subscription.items.data[0]?.price.recurring?.interval;
      const isAnnual = interval === "year";

      const couponParams = isAnnual
        ? {
            percent_off: Math.min(100, Math.round(qualifiedCount * (200 / 12) * 100) / 100),
            duration: "once" as const,
            name: `Referral reward: ${qualifiedCount} successful referral${qualifiedCount === 1 ? "" : "s"}`,
          }
        : {
            percent_off: 100,
            duration: "repeating" as const,
            duration_in_months: 2 * qualifiedCount,
            name: `Referral reward: ${qualifiedCount * 2} free months`,
          };

      if (!LIVE) {
        console.log(
          `[referral-rewards dry run] would qualify referral ${referral.id} (${referrer.name} referred ${referred.name}), grant coupon:`,
          JSON.stringify(couponParams)
        );
        summary.push({ referralId: referral.id, qualified: false, dryRun: true, wouldGrant: couponParams });
        continue;
      }

      const coupon = await getStripe().coupons.create(couponParams);
      await getStripe().subscriptions.update(referrer.stripe_subscription_id, { discounts: [{ coupon: coupon.id }] });

      await supabase.from("referrals").update({ qualified_at: new Date().toISOString() }).eq("id", referral.id);
      await supabase.from("accounts").update({ referral_reward_coupon_id: coupon.id }).eq("id", referral.referrer_account_id);

      if (referrer.contact_email) {
        sendReferralRewardEmail(referrer.contact_email, referrer.name, referred.name, qualifiedCount * 2, appUrl).catch(
          (err) => console.error("referral reward email failed:", err)
        );
      }

      summary.push({ referralId: referral.id, qualified: true, couponId: coupon.id });
    } catch (err) {
      console.error(`referral reward grant failed for referral ${referral.id}:`, err);
      summary.push({ referralId: referral.id, qualified: false, error: true });
    }
  }

  return NextResponse.json({ ok: true, live: LIVE, summary });
}
