import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

// Stripe promotion codes are immutable on discount % and duration once
// created — the only thing you can change after the fact is whether it's
// redeemable. To change the discount or duration, create a new code instead.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const active = body?.active;

  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "active must be a boolean." }, { status: 400 });
  }

  try {
    const promotionCode = await getStripe().promotionCodes.update(id, { active });
    return NextResponse.json({ active: promotionCode.active });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update promo code.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
