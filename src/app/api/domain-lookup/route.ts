import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { DOMAIN_PATTERN, normalizeDomain } from "@/lib/domain";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// One-line description pulled from the domain's own homepage meta tags —
// no third-party enrichment API, just a quick fetch + parse. Logos are
// handled entirely client-side via a free, keyless logo service.
export async function GET(request: Request) {
  if (!checkRateLimit(`domain-lookup:${getClientIp(request)}`, 30, 60_000)) {
    return NextResponse.json({ description: null }, { status: 429 });
  }

  const raw = new URL(request.url).searchParams.get("domain") ?? "";
  const domain = normalizeDomain(raw).toLowerCase();
  if (!domain || !DOMAIN_PATTERN.test(domain)) {
    return NextResponse.json({ description: null });
  }

  try {
    const res = await fetch(`https://${domain}`, {
      headers: { "User-Agent": "RipplewatchBot/1.0 (+https://ripplewatch.ai)" },
      signal: AbortSignal.timeout(5_000),
      redirect: "follow",
    });
    // 401/403/429/503 from a normal homepage almost always means bot
    // protection (Cloudflare, Akamai and the like) turning an automated request
    // away. Say so, so the form can explain a blank preview instead of looking
    // broken. Any other failure stays quiet: it could just be a bad day.
    if (!res.ok) return NextResponse.json({ description: null, blocked: [401, 403, 429, 503].includes(res.status) });

    const html = await res.text();
    const $ = cheerio.load(html);
    const description =
      $('meta[name="description"]').attr("content")?.trim() ||
      $('meta[property="og:description"]').attr("content")?.trim() ||
      $("title").text().trim() ||
      null;

    return NextResponse.json({ description: description ? description.slice(0, 160) : null });
  } catch {
    // Unreachable, timed out, or blocked us — fail quiet, this is a nice-to-have preview.
    return NextResponse.json({ description: null });
  }
}
