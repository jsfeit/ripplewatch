import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Same app-only disallow list every user agent gets — the wildcard rule
// below already covers these bots implicitly (nothing disallows them
// specifically), but they're broken out explicitly anyway: an explicit
// allow is a clearer, unambiguous signal of intent than relying on a
// generic "*" rule, and it means these specific bots keep working the same
// way even if the wildcard rule's disallow list ever changes for an
// unrelated reason.
const DISALLOW = ["/app", "/admin", "/api", "/login", "/signup", "/onboarding", "/invite"];

// GPTBot (OpenAI), ClaudeBot (Anthropic), PerplexityBot (Perplexity),
// Google-Extended (Gemini/AI Overviews training), Applebot-Extended (Apple
// Intelligence), CCBot (Common Crawl, which several AI labs train on) —
// explicitly allowed rather than left to the wildcard, since being findable
// by AI answer engines (ChatGPT, Perplexity, AI Overviews) matters as much
// as traditional search here.
const AI_CRAWLERS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/", disallow: DISALLOW })),
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
