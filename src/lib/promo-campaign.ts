import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

// One evergreen campaign, not a history table — always the oldest row (see
// migration 0039). Two narrow read paths instead of one "fetch everything"
// function so each caller only ever sees the columns it needs: the banner
// never touches stripe_coupon_id, checkout never touches banner_text.

// The root layout reads this on every render, so any page that is not pre-built (sign-in, onboarding,
// the whole app) used to wait on a database round trip first. The banner changes a few times a year,
// so it is cached for a minute and the admin save clears it at once (see PROMO_BANNER_TAG).
export const PROMO_BANNER_TAG = "promo-banner";

async function readBannerCampaign(): Promise<{ bannerText: string; linkUrl: string } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("promo_campaigns")
    .select("active, banner_text, link_url")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data || !data.active) return null;
  return { bannerText: data.banner_text, linkUrl: data.link_url };
}

export const getBannerCampaign = unstable_cache(readBannerCampaign, ["promo-banner"], {
  revalidate: 60,
  tags: [PROMO_BANNER_TAG],
});

export async function getCheckoutCampaign(): Promise<{ stripeCouponId: string } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("promo_campaigns")
    .select("active, stripe_coupon_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data || !data.active || !data.stripe_coupon_id) return null;
  return { stripeCouponId: data.stripe_coupon_id };
}
