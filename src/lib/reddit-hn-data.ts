import "server-only";

// Free public "how much are people talking about this company" read, built
// from the two sources that don't require a paid social-listening tool.
// Hacker News works unauthenticated for anyone; Reddit's old unauthenticated
// search.json endpoint is now bot-blocked (confirmed live: 403 even with a
// real browser User-Agent, same class of block as the bot-blocked competitor
// pages elsewhere in this codebase) — Reddit's own free "script" app OAuth
// (client_credentials, app-only, no user login) still works for read-only
// search, so that's what's used here, gated behind REDDIT_CLIENT_ID/
// REDDIT_CLIENT_SECRET. Buzz tracking still works from HN alone when those
// aren't set; Reddit just doesn't contribute until they are.

const HN_ALGOLIA_BASE = "https://hn.algolia.com/api/v1/search";
const REDDIT_TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const REDDIT_SEARCH_BASE = "https://oauth.reddit.com/search";
const USER_AGENT = "RipplewatchBot/1.0 (+https://ripplewatch.ai)";
const LOOKBACK_DAYS = 30;

export type Mention = { title: string; source: "hackernews" | "reddit" };

async function fetchHNMentions(companyName: string): Promise<Mention[]> {
  const since = Math.floor(Date.now() / 1000) - LOOKBACK_DAYS * 24 * 60 * 60;
  const url = `${HN_ALGOLIA_BASE}?query=${encodeURIComponent(`"${companyName}"`)}&tags=(story,comment)&numericFilters=created_at_i>${since}&hitsPerPage=50`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { hits?: { title?: string | null; comment_text?: string | null }[] };
    return (data.hits ?? [])
      .map((h) => h.title ?? h.comment_text?.slice(0, 100) ?? null)
      .filter((t): t is string => Boolean(t))
      .map((title) => ({ title, source: "hackernews" as const }));
  } catch (err) {
    console.error(`HN mention search failed for ${companyName}:`, err);
    return [];
  }
}

let cachedRedditToken: { token: string; expiresAt: number } | null = null;

async function getRedditAppToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (cachedRedditToken && cachedRedditToken.expiresAt > Date.now()) return cachedRedditToken.token;

  try {
    const res = await fetch(REDDIT_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    // Refresh a minute early rather than exactly on expiry.
    cachedRedditToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000 };
    return data.access_token;
  } catch (err) {
    console.error("Reddit app-only token request failed:", err);
    return null;
  }
}

async function fetchRedditMentions(companyName: string): Promise<Mention[]> {
  const token = await getRedditAppToken();
  if (!token) return [];

  const url = `${REDDIT_SEARCH_BASE}?q=${encodeURIComponent(`"${companyName}"`)}&sort=new&t=month&limit=50`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: { children?: { data?: { title?: string } }[] } };
    return (data.data?.children ?? [])
      .map((c) => c.data?.title)
      .filter((t): t is string => Boolean(t))
      .map((title) => ({ title, source: "reddit" as const }));
  } catch (err) {
    console.error(`Reddit mention search failed for ${companyName}:`, err);
    return [];
  }
}

// Combined mention count + titles for the trailing 30 days, used by
// checkBuzzMentions in scraping.ts: the count feeds momentum's "buzz_mentions"
// magnitude metric, the titles feed summarizeBuzzSentiment's tone read.
export async function fetchBuzzMentions(companyName: string): Promise<Mention[]> {
  const [hn, reddit] = await Promise.all([fetchHNMentions(companyName), fetchRedditMentions(companyName)]);
  return [...hn, ...reddit];
}
