import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizeDomain, guessPricingUrl, DOMAIN_PATTERN } from "@/lib/domain";
import { fetchPageText } from "@/lib/scraping";
import { extractPricingStructure } from "@/lib/anthropic";

// One title fetch, one pricing-page fetch, and (only if that page actually
// returned text) one LLM extraction call — comfortably inside Vercel's
// default, but explicit since a slow/uncooperative third-party site could
// otherwise eat into it.
export const maxDuration = 30;

// This is the one endpoint in the app that fetches a domain typed in by an
// anonymous, unauthenticated visitor — every other scrape target
// (competitors.domain) comes from an already-signed-in account. Blocking
// obvious loopback/private/link-local hosts here is a cheap, real guard
// against using this as a probe against internal infrastructure; it isn't
// a full SSRF defense (that would need resolving DNS and checking the
// resulting IP), but it closes the obvious door for the cost involved.
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /\.local$/i,
  /\.internal$/i,
];

function isBlockedHost(domain: string): boolean {
  return BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(domain));
}

async function fetchTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "RipplewatchBot/1.0 (+https://ripplewatch.ai)" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    return match ? match[1].trim().slice(0, 200) || null : null;
  } catch {
    return null;
  }
}

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

  const domain = normalizeDomain(rawDomain);
  if (!DOMAIN_PATTERN.test(domain) || isBlockedHost(domain)) {
    return NextResponse.json({ error: "Enter a real competitor domain, e.g. acme.com." }, { status: 400 });
  }

  // Lead is captured regardless of whether the live fetch below succeeds —
  // some sites block automated requests, and that's still a real visitor
  // worth having, not a wasted submission.
  const supabase = createAdminClient();
  const { error: leadError } = await supabase.from("leads").insert({
    email,
    utm_source: utmSource || null,
    utm_medium: utmMedium || null,
    utm_campaign: utmCampaign || null,
    capture_point: "snapshot",
  });
  if (leadError && leadError.code !== "23505") {
    console.error("snapshot lead insert failed:", leadError);
  }

  const homepageUrl = `https://${domain}`;
  const title = await fetchTitle(homepageUrl);

  let pricing: Awaited<ReturnType<typeof extractPricingStructure>> | null = null;
  const pricingUrl = guessPricingUrl(domain);
  if (pricingUrl) {
    try {
      const pricingText = await fetchPageText(pricingUrl);
      if (pricingText.trim().length > 100) {
        pricing = await extractPricingStructure(pricingText, null);
      }
    } catch (err) {
      console.error(`snapshot pricing fetch failed for ${domain}:`, err);
    }
  }

  return NextResponse.json({
    domain,
    reachable: title !== null || pricing !== null,
    title,
    pricing,
  });
}
