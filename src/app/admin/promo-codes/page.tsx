import { getStripe } from "@/lib/stripe";
import { PromoCodesView, type PromoCode } from "@/components/admin/promo-codes-view";

export const metadata = { title: "Promo codes — Admin" };
export const dynamic = "force-dynamic";

async function loadCodes(): Promise<{ codes: PromoCode[]; error: string | null }> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { codes: [], error: "STRIPE_SECRET_KEY is not configured." };
  }
  try {
    const promotionCodes = await getStripe().promotionCodes.list({
      limit: 100,
      expand: ["data.promotion.coupon"],
    });
    const codes = promotionCodes.data
      .map((pc) => {
        const coupon = pc.promotion.coupon;
        if (!coupon || typeof coupon === "string") {
          throw new Error("Expected coupon to be expanded.");
        }
        return {
          id: pc.id,
          code: pc.code,
          active: pc.active,
          percentOff: coupon.percent_off,
          durationInMonths: coupon.duration_in_months ?? null,
          duration: coupon.duration,
          timesRedeemed: pc.times_redeemed,
          maxRedemptions: pc.max_redemptions,
          created: pc.created,
        };
      })
      .sort((a, b) => b.created - a.created);
    return { codes, error: null };
  } catch (err) {
    return { codes: [], error: err instanceof Error ? err.message : "Could not load promo codes." };
  }
}

export default async function AdminPromoCodesPage() {
  const { codes, error } = await loadCodes();

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Promo codes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Customers enter these at Stripe Checkout. Discount % and duration are locked once a code is
          created — make a new code to change them.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Couldn&apos;t load promo codes: {error}
        </p>
      ) : (
        <PromoCodesView initialCodes={codes} />
      )}
    </div>
  );
}
