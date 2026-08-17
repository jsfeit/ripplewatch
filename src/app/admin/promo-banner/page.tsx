import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { SupabaseNotConfigured } from "@/components/admin/not-configured";
import { PromoBannerManager } from "@/components/admin/promo-banner-manager";
import { getStripe } from "@/lib/stripe";
import { PromoCodesView, type PromoCode } from "@/components/admin/promo-codes-view";

export const metadata = { title: "Promotions | Admin" };
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

export default async function AdminPromotionsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-10">
        <SupabaseNotConfigured />
      </div>
    );
  }

  const supabase = createAdminClient();
  const [{ data: campaign }, { codes, error: codesError }] = await Promise.all([
    supabase
      .from("promo_campaigns")
      .select("active, percent_off, duration_months, code, banner_text, link_url")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    loadCodes(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-12 px-8 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Promotions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Two different mechanisms: the evergreen banner applies automatically with no code to type in, one
          promo running at a time. One-off codes are separate, customer-entered ones you can hand out
          individually (a partner, a LinkedIn post) alongside or instead of the banner.
        </p>
      </div>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-medium">Evergreen banner</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            When on, applies automatically at checkout for any new self-serve signup and shows a dismissible
            banner across the public site.
          </p>
        </div>
        <PromoBannerManager
          initial={
            campaign
              ? {
                  active: campaign.active,
                  percentOff: campaign.percent_off,
                  durationMonths: campaign.duration_months,
                  code: campaign.code,
                  bannerText: campaign.banner_text,
                  linkUrl: campaign.link_url,
                }
              : null
          }
        />
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-medium">One-off codes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Customers enter these at Stripe Checkout. Discount % and duration are locked once a code is
            created; make a new code to change them.
          </p>
        </div>
        {codesError ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            Couldn&apos;t load promo codes: {codesError}
          </p>
        ) : (
          <PromoCodesView initialCodes={codes} />
        )}
      </section>
    </div>
  );
}
