import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizeDomain, DOMAIN_PATTERN, isBlockedHost } from "@/lib/domain";
import { buildSnapshot, recordSnapshotLead, toLookup } from "@/lib/snapshot";
import { sendSnapshotManualCheckAlertEmail } from "@/lib/resend";

// Homepage + pricing (live, then archived) + hiring board all run in
// parallel with their own time caps (see the snapshot fetchers in
// scraping.ts), plus one LLM extraction call, so the worst case lands well
// under this. Explicit because a slow or uncooperative third-party site
// could otherwise eat into it.
export const maxDuration = 60;

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!checkRateLimit(`snapshot:${getClientIp(request)}`, 5, 60 * 60_000)) {
    return NextResponse.json({ error: "Too many requests. Try again in a bit." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const rawDomain = typeof body?.domain === "string" ? body.domain.trim() : "";
  const utmSource = typeof body?.utm_source === "string" ? body.utm_source.trim().slice(0, 100) : "";
  const utmMedium = typeof body?.utm_medium === "string" ? body.utm_medium.trim().slice(0, 100) : "";
  const utmCampaign = typeof body?.utm_campaign === "string" ? body.utm_campaign.trim().slice(0, 100) : "";

  if (!VALID_EMAIL.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const domain = normalizeDomain(rawDomain).toLowerCase();
  if (!DOMAIN_PATTERN.test(domain) || isBlockedHost(domain)) {
    return NextResponse.json({ error: "Enter a real competitor domain, e.g. acme.com." }, { status: 400 });
  }

  const result = await buildSnapshot(domain);

  // Recorded whether or not we found anything (see recordSnapshotLead).
  // Awaited, not fire-and-forget: on a serverless function the work can be
  // cut off once the response is sent.
  const supabase = createAdminClient();
  await recordSnapshotLead(supabase, {
    email,
    utmSource,
    utmMedium,
    utmCampaign,
    lookup: toLookup(result),
  });

  if (result.needsManualCheck) {
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    try {
      await sendSnapshotManualCheckAlertEmail(adminEmails, { email, domain });
    } catch (err) {
      console.error("snapshot manual-check alert failed:", err);
    }
  }

  return NextResponse.json(result);
}
