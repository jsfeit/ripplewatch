import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

// Gated by middleware (/api/admin/:path* requires an admin session).

export async function GET() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("promo_campaigns")
    .select("id, active, percent_off, duration_months, code, banner_text")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return NextResponse.json({ campaign: data ?? null });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const active: unknown = body?.active;
  const percentOff: unknown = body?.percentOff;
  const durationMonths: unknown = body?.durationMonths;
  const code: unknown = body?.code;
  const bannerText: unknown = body?.bannerText;

  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "active must be true or false." }, { status: 400 });
  }
  if (!Number.isFinite(percentOff) || (percentOff as number) <= 0 || (percentOff as number) > 100) {
    return NextResponse.json({ error: "Discount must be between 1 and 100 percent." }, { status: 400 });
  }
  if (!Number.isInteger(durationMonths) || (durationMonths as number) <= 0) {
    return NextResponse.json({ error: "Duration must be a positive whole number of months." }, { status: 400 });
  }
  if (typeof code !== "string" || !code.trim()) {
    return NextResponse.json({ error: "Code label is required." }, { status: 400 });
  }
  if (typeof bannerText !== "string" || !bannerText.trim()) {
    return NextResponse.json({ error: "Banner text is required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("promo_campaigns")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Stripe coupons are immutable once created — a new percent/duration
  // means a genuinely new coupon, not an edit. Toggling active on/off or
  // just changing the banner text/code label reuses the existing one.
  let stripeCouponId = existing?.stripe_coupon_id ?? null;
  const settingsChanged =
    !existing || existing.percent_off !== percentOff || existing.duration_months !== durationMonths;

  if (settingsChanged) {
    try {
      const coupon = await getStripe().coupons.create({
        percent_off: percentOff as number,
        duration: "repeating",
        duration_in_months: durationMonths as number,
        name: `${code}: ${percentOff}% off for ${durationMonths} month${durationMonths === 1 ? "" : "s"}`,
      });
      stripeCouponId = coupon.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create Stripe coupon.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const payload = {
    active,
    percent_off: percentOff as number,
    duration_months: durationMonths as number,
    code: (code as string).trim(),
    banner_text: (bannerText as string).trim(),
    stripe_coupon_id: stripeCouponId,
    updated_at: new Date().toISOString(),
  };

  const { error } = existing
    ? await admin.from("promo_campaigns").update(payload).eq("id", existing.id)
    : await admin.from("promo_campaigns").insert(payload);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, stripeCouponId });
}
