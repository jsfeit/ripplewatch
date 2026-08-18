import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Fired the moment someone clears the first step of onboarding (company
// name + email), before they've entered competitors, picked a plan, or set
// a password — so if they abandon anywhere in the rest of the funnel, we
// still have an email to retarget with instead of losing them entirely.
// Writes to the same waitlist_signups table the old pre-launch waitlist
// used, which the admin leads view already reads from.
export async function POST(request: Request) {
  if (!checkRateLimit(`onboarding-lead:${getClientIp(request)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const companyName = typeof body?.company === "string" ? body.company.trim() : "";
  const utmSource = typeof body?.utm_source === "string" ? body.utm_source.trim().slice(0, 100) : "";
  const utmMedium = typeof body?.utm_medium === "string" ? body.utm_medium.trim().slice(0, 100) : "";
  const utmCampaign = typeof body?.utm_campaign === "string" ? body.utm_campaign.trim().slice(0, 100) : "";

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!isValid) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("waitlist_signups").insert({
    email,
    company_name: companyName || null,
    utm_source: utmSource || null,
    utm_medium: utmMedium || null,
    utm_campaign: utmCampaign || null,
  });

  // Unique violation on email — this email was already captured (e.g. a
  // retry, or they left and came back). Not an error from the caller's POV.
  if (error && error.code !== "23505") {
    console.error("onboarding lead insert failed:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
