import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// One evergreen campaign, not a history table — always the oldest row (see
// migration 0039). Two narrow read paths instead of one "fetch everything"
// function so each caller only ever sees the columns it needs: the banner
// never touches stripe_coupon_id, checkout never touches banner_text.

export async function getBannerCampaign(): Promise<{ bannerText: string } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("promo_campaigns")
    .select("active, banner_text")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data || !data.active) return null;
  return { bannerText: data.banner_text };
}

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
