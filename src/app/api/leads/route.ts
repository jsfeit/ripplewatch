import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Shared lead-capture endpoint — not tied to any one funnel. Currently fed
// by onboarding's first step (before competitors, plan, password, or
// payment) and the competitive-intel quiz's email-gated results, so that
// abandoning either one still leaves an email to retarget with. Writes to
// the "leads" table, tagged with capturePoint so the admin view can tell
// where each row came from.
const VALID_CAPTURE_POINTS = new Set(["onboarding", "quiz"]);

export async function POST(request: Request) {
  if (!checkRateLimit(`lead-capture:${getClientIp(request)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const companyName = typeof body?.company === "string" ? body.company.trim() : "";
  const utmSource = typeof body?.utm_source === "string" ? body.utm_source.trim().slice(0, 100) : "";
  const utmMedium = typeof body?.utm_medium === "string" ? body.utm_medium.trim().slice(0, 100) : "";
  const utmCampaign = typeof body?.utm_campaign === "string" ? body.utm_campaign.trim().slice(0, 100) : "";
  const capturePoint = typeof body?.capturePoint === "string" && VALID_CAPTURE_POINTS.has(body.capturePoint)
    ? body.capturePoint
    : null;

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!isValid) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("leads").insert({
    email,
    company_name: companyName || null,
    utm_source: utmSource || null,
    utm_medium: utmMedium || null,
    utm_campaign: utmCampaign || null,
    capture_point: capturePoint,
  });

  // Unique violation on email — this email was already captured (e.g. a
  // retry, or they left and came back). Not an error from the caller's POV.
  if (error && error.code !== "23505") {
    console.error("lead insert failed:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
