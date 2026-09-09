import "server-only";

// Real visual diffing (catching a redesign, an image swap, or any other
// change that doesn't show up in the plain-text hash checkProductMessagingDiff
// already does) needs an actual rendered screenshot — nothing in this
// codebase runs a headless browser, and doing that reliably on Vercel needs
// extra infra (a bundled Chromium binary, cold-start cost) this doesn't
// have. ScreenshotOne is a hosted screenshot API instead: give it a URL, get
// a PNG back, no browser to run ourselves. Requires
// SCREENSHOTONE_ACCESS_KEY; captureScreenshot returns null when it's unset,
// same dormant-until-configured pattern as fetchActiveAdCount
// (meta-ads-data.ts) for Meta Ad Library.
const SCREENSHOTONE_BASE = "https://api.screenshotone.com/take";

export async function captureScreenshot(url: string): Promise<Buffer | null> {
  const accessKey = process.env.SCREENSHOTONE_ACCESS_KEY;
  if (!accessKey) return null;

  const params = new URLSearchParams({
    access_key: accessKey,
    url,
    format: "png",
    viewport_width: "1280",
    viewport_height: "800",
    device_scale_factor: "1",
    // Ads/cookie banners/trackers are the single biggest source of
    // week-to-week visual noise unrelated to any real competitor change —
    // blocking them keeps the comparison focused on the page itself.
    block_ads: "true",
    block_cookie_banners: "true",
    block_trackers: "true",
    block_chats: "true",
    cache: "false",
    full_page: "false",
  });

  try {
    const res = await fetch(`${SCREENSHOTONE_BASE}?${params.toString()}`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      console.error(`ScreenshotOne capture failed (${res.status}) for ${url}`);
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.error(`ScreenshotOne capture failed for ${url}:`, err);
    return null;
  }
}
