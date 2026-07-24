import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

function randomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity
  let code = "";
  for (let i = 0; i < 8; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

export async function GET() {
  const stripe = getStripe();
  const promotionCodes = await stripe.promotionCodes.list({
    limit: 100,
    expand: ["data.promotion.coupon"],
  });

  const codes = promotionCodes.data.map((pc) => {
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
  });

  codes.sort((a, b) => b.created - a.created);

  return NextResponse.json({ codes });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const percentOff = Number(body?.percentOff);
  const months = Number(body?.months);
  const requestedCode: unknown = body?.code;
  const maxRedemptions: unknown = body?.maxRedemptions;

  if (!Number.isFinite(percentOff) || percentOff <= 0 || percentOff > 100) {
    return NextResponse.json({ error: "Discount must be between 1 and 100 percent." }, { status: 400 });
  }
  if (!Number.isInteger(months) || months <= 0) {
    return NextResponse.json({ error: "Number of months must be a positive whole number." }, { status: 400 });
  }

  const code =
    typeof requestedCode === "string" && requestedCode.trim()
      ? requestedCode.trim().toUpperCase().replace(/\s+/g, "-")
      : randomCode();

  const stripe = getStripe();

  try {
    const coupon = await stripe.coupons.create({
      percent_off: percentOff,
      duration: "repeating",
      duration_in_months: months,
      name: `${percentOff}% off for ${months} month${months === 1 ? "" : "s"}`,
    });

    const promotionCode = await stripe.promotionCodes.create({
      promotion: { type: "coupon", coupon: coupon.id },
      code,
      active: true,
      ...(Number.isInteger(maxRedemptions) && Number(maxRedemptions) > 0
        ? { max_redemptions: Number(maxRedemptions) }
        : {}),
    });

    return NextResponse.json({
      code: {
        id: promotionCode.id,
        code: promotionCode.code,
        active: promotionCode.active,
        percentOff,
        durationInMonths: months,
        duration: "repeating",
        timesRedeemed: 0,
        maxRedemptions: promotionCode.max_redemptions,
        created: promotionCode.created,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create promo code.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
