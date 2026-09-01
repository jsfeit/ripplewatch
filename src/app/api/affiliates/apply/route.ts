import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendAffiliateApplicationEmail } from "@/lib/resend";

// Lead-capture only for now — no automated commission tracking or payout
// logic. Every submission is reviewed by hand (see Admin > Affiliates), so
// the only automated step here is getting it in front of a person fast.
const NOTIFY_EMAIL = "jeremyripplewatch@gmail.com";

export async function POST(request: Request) {
  if (!checkRateLimit(`affiliate-apply:${getClientIp(request)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const whyGoodFit = typeof body?.whyGoodFit === "string" ? body.whyGoodFit.trim() : "";
  const channels = typeof body?.channels === "string" ? body.channels.trim() : "";

  if (!name || !whyGoodFit || !channels) {
    return NextResponse.json({ error: "Name, why you'd be a good fit, and your channels are required." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("affiliate_applications").insert({
    name,
    email,
    why_good_fit: whyGoodFit,
    channels,
  });

  if (error) {
    console.error("affiliate application insert failed:", error);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }

  sendAffiliateApplicationEmail([NOTIFY_EMAIL], { name, email, whyGoodFit, channels }).catch((err) =>
    console.error("affiliate application notification email failed:", err)
  );

  return NextResponse.json({ ok: true });
}
