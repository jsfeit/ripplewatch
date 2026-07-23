import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { DOMAIN_PATTERN, normalizeDomain } from "@/lib/domain";

// One-line description pulled from the domain's own homepage meta tags —
// no third-party enrichment API, just a quick fetch + parse. Logos are
// handled entirely client-side via a free, keyless logo service.
export async function GET(request: Request) {
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
    if (!res.ok) return NextResponse.json({ description: null });

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
