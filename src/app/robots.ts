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

// Retrieval-time crawlers: fetch a page live, right when a user asks an AI
// answer engine a question, to ground/cite that specific answer — distinct
// from the training-time crawlers below, which scrape on their own schedule
// to build a model. Both matter here, but they're different products with
// different names per vendor, so they get their own explicit list rather
// than being lumped in with training bots.
const AI_RETRIEVAL_CRAWLERS = [
  "OAI-SearchBot", // ChatGPT's web-search feature
  "ChatGPT-User", // fetches a page a ChatGPT user explicitly linked/asked about
  "PerplexityBot", // Perplexity's own indexing/retrieval crawler
  "Perplexity-User", // fetches a page a Perplexity user explicitly asked about
  "Claude-User", // fetches a page a Claude user explicitly asked about
  "Claude-SearchBot", // Claude's web-search feature
];

// Training-time crawlers: scrape to build/update a model, not to answer one
// specific live question. Allowed by default — being trained on is what
// makes a model able to describe Ripplewatch accurately at all, even before
// any live retrieval happens. Revisit here if that tradeoff ever changes.
const AI_TRAINING_CRAWLERS = [
  "GPTBot", // OpenAI
  "ClaudeBot", // Anthropic
  "anthropic-ai", // Anthropic (older/alternate token some tools still send)
  "Google-Extended", // Gemini / AI Overviews training
  "CCBot", // Common Crawl, which several AI labs train on
  "Applebot-Extended", // Apple Intelligence
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      ...AI_RETRIEVAL_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/", disallow: DISALLOW })),
      ...AI_TRAINING_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/", disallow: DISALLOW })),
      // Bytespider (ByteDance/TikTok's crawler): widely reported ignoring
      // robots.txt and scraping abusively — blocked outright rather than
      // extended the same trust the crawlers above get.
      { userAgent: "Bytespider", disallow: "/" },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
