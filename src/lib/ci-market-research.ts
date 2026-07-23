// Sourced from a survey of public pricing pages, product marketing, and
// review aggregators compiled July 2026. Kept separate from marketing copy
// so it can be corrected independently if a competitor's product changes —
// this is meant to stay factually accurate, not read as a pitch.

export type MarketTier = "leaders" | "mid-market" | "ai-native";

export type ToolProfile = {
  name: string;
  domain: string;
  tier: MarketTier;
  pricing: string;
  summary: string;
};

export const TOOL_PROFILES: ToolProfile[] = [
  // Mid-market
  {
    name: "Kompyte",
    domain: "kompyte.com",
    tier: "mid-market",
    pricing: "~$300–$1,250/mo",
    summary:
      "Centers on a \"Before & After Time Machine\" showing side-by-side website diffs, plus a customizable activity feed of pricing, feature, and messaging changes. Battlecards push directly into Salesforce and HubSpot.",
  },
  {
    name: "Contify",
    domain: "contify.com",
    tier: "mid-market",
    pricing: "Custom quote",
    summary:
      "Built for full-funnel market and corporate intelligence rather than just sales battlecards. Clean, deduplicated feeds are a stated differentiator, filtering repetitive PR mentions down to strategically distinct signals across 1M+ multilingual sources.",
  },
  {
    name: "Similarweb",
    domain: "similarweb.com",
    tier: "mid-market",
    pricing: "Freemium, then $100s–$1,000s/mo",
    summary:
      "A pure traffic and audience-analytics data terminal — rank, visit volume, traffic-source breakdown, audience overlap. No synthesis or \"why it matters\" layer; interpretation is left entirely to the analyst reading it.",
  },
  {
    name: "Owler",
    domain: "owler.com",
    tier: "mid-market",
    pricing: "Freemium, paid ~$35–$100/mo historically",
    summary:
      "Company-profile-centric: a snapshot page per competitor with crowd-sourced revenue and headcount estimates, recent news, and a graph of related companies. Real-time alerts on leadership changes and funding are the core sell.",
  },
  {
    name: "LinkedIn Sales Navigator",
    domain: "linkedin.com/sales",
    tier: "mid-market",
    pricing: "~$960/yr (Core tier)",
    summary:
      "Not a monitoring dashboard by design — an account/lead intelligence tool repurposed for competitive intel via saved searches and alerts on job changes, company updates, and posts from people at tracked accounts.",
  },
  // AI-native / lean
  {
    name: "Parano.ai",
    domain: "parano.ai",
    tier: "ai-native",
    pricing: "$89/competitor/mo",
    summary:
      "Weekly digest format: each tracked competitor gets an AI-written summary spanning pricing, product, hiring, and reviews, delivered to Slack or Teams rather than requiring a dashboard login.",
  },
  {
    name: "Compttr",
    domain: "compttr.com",
    tier: "ai-native",
    pricing: "Free tier; ~$9–10/report; ~$19–20/mo",
    summary:
      "On-demand only, no continuous monitoring. Paste a competitor's name and get a review-mined report (G2, Capterra, Trustpilot) in about 60 seconds, oriented around sentiment themes rather than day-to-day change detection.",
  },
  {
    name: "Competely",
    domain: "competely.ai",
    tier: "ai-native",
    pricing: "Not publicly listed",
    summary:
      "A single-input comparison tool: paste a competitor's URL and get a 100+ data-point snapshot against your own product. A comparison engine for a point-in-time decision, not an ongoing monitor.",
  },
  {
    name: "RivalSense",
    domain: "rivalsense.co",
    tier: "ai-native",
    pricing: "$44.99–$222.99/mo",
    summary:
      "A weekly curated briefing pulling from 80+ sources, explicitly designed to avoid a \"Google Alerts flood\" — includes a downvote mechanic so the system learns which insight types a given user doesn't want to see again.",
  },
  {
    name: "Caelian",
    domain: "caelian.ai",
    tier: "ai-native",
    pricing: "Free during beta",
    summary:
      "Built around a P0/P1/P2 priority framework aimed at CEOs rather than analysts — a live dashboard plus a daily brief that suppresses everything below the priority threshold. Positions itself as predictive, treating hiring and regulatory filings as leading indicators.",
  },
  {
    name: "Seeto",
    domain: "seeto.ai",
    tier: "ai-native",
    pricing: "Free (1/mo); $29/mo; $79/mo Pro",
    summary:
      "Paste competitor URLs and get a structured 5-dimension report in about 5 minutes: features, pricing, SEO, positioning, messaging. Pro tier adds scheduled recurring analyses and a \"compare to previous run\" view.",
  },
  {
    name: "Analook",
    domain: "analook.com",
    tier: "ai-native",
    pricing: "Free (2/mo); $29/mo Pro; $5/report",
    summary:
      "One of the broadest single-report tools: a 60-second teardown spanning SEO, traffic, social, Product Hunt history, GitHub activity, pricing, and Wayback Machine history, capped with an AI \"strategic verdict.\" Offers an MCP integration for use inside Claude Desktop or Cursor.",
  },
  {
    name: "Outmano",
    domain: "outmano.com",
    tier: "ai-native",
    pricing: "From $49/mo",
    summary:
      "Dedicated AI agents monitor each \"angle\" (pricing, features, SEO, hiring) independently, then a meta-agent synthesizes everything into one Monday-morning email grouped by competitor, each with a short strategic assessment.",
  },
  {
    name: "Steve",
    domain: "hiresteve.ai",
    tier: "ai-native",
    pricing: "Not publicly published",
    summary:
      "Pitched explicitly as \"Crayon or Klue, but Slack-native.\" Distinctively, it mines your own sales calls and internal Slack #competitors channel for competitor mentions, not just external web monitoring.",
  },
];

// Crayon, Klue, and AlphaSense are the market's established leaders, but
// detailed public specifics were thinner to compile than the tools above —
// mentioned here at the level the research actually supports, not padded
// out to match the others.
export const LEADER_NOTES = {
  crayon: "Crayon's Compete Hub pairs a per-competitor feed with \"Sparks,\" an importance-scoring layer that filters noise before it reaches the dashboard, plus native Slack Insights for push delivery.",
  klue: "Klue's \"Ask Klue\" answers are drawn strictly from validated internal data — a trust mechanism more than a relevance one — feeding into sales battlecards.",
  alphaSense: "AlphaSense sits closer to enterprise financial research than startup competitive intel, with its public footprint concentrated on funding and market-news coverage rather than product-level signals.",
};

export const LONG_TAIL_NOTE =
  "Further down the long tail: CompetAI (PDF reports for small businesses), Playwise HQ (positions directly against Crayon's \"bloated dashboards,\" ~$3,000+/yr), WatchMyCompetitor, Competitors App (tracks newsletters and blog updates alongside standard monitoring), IndustryLens (a Monday \"verified summary\" briefing), Valona Intelligence (enterprise financial-benchmarking dashboards), and a self-hosted \"Klue Alternative\" n8n template ($50 one-time plus API costs) — all with thinner independent detail than the tools profiled above, but worth noting as demand signals for the category.";

export type CoverageRow = {
  name: string;
  pricing: boolean;
  features: boolean;
  seoTraffic: boolean;
  hiring: boolean;
  reviews: boolean;
  social: boolean;
  fundingNews: boolean;
  crmDealData: boolean;
};

export const COVERAGE_HEATMAP: CoverageRow[] = [
  { name: "Crayon", pricing: true, features: true, seoTraffic: false, hiring: true, reviews: true, social: true, fundingNews: true, crmDealData: true },
  { name: "Klue", pricing: true, features: true, seoTraffic: false, hiring: false, reviews: false, social: false, fundingNews: false, crmDealData: true },
  { name: "AlphaSense", pricing: false, features: false, seoTraffic: false, hiring: false, reviews: false, social: false, fundingNews: true, crmDealData: false },
  { name: "Kompyte", pricing: true, features: true, seoTraffic: true, hiring: true, reviews: false, social: true, fundingNews: false, crmDealData: true },
  { name: "Contify", pricing: true, features: true, seoTraffic: false, hiring: false, reviews: false, social: false, fundingNews: true, crmDealData: false },
  { name: "Similarweb", pricing: false, features: false, seoTraffic: true, hiring: false, reviews: false, social: false, fundingNews: false, crmDealData: false },
  { name: "Owler", pricing: false, features: false, seoTraffic: false, hiring: false, reviews: true, social: false, fundingNews: true, crmDealData: false },
  { name: "LinkedIn Sales Nav", pricing: false, features: false, seoTraffic: false, hiring: true, reviews: false, social: true, fundingNews: false, crmDealData: true },
  { name: "Parano.ai", pricing: true, features: true, seoTraffic: false, hiring: true, reviews: true, social: false, fundingNews: true, crmDealData: false },
  { name: "Compttr", pricing: false, features: false, seoTraffic: false, hiring: false, reviews: true, social: false, fundingNews: false, crmDealData: false },
  { name: "Competely", pricing: true, features: true, seoTraffic: false, hiring: false, reviews: false, social: false, fundingNews: false, crmDealData: false },
  { name: "RivalSense", pricing: true, features: true, seoTraffic: false, hiring: true, reviews: false, social: true, fundingNews: true, crmDealData: false },
  { name: "Caelian", pricing: true, features: true, seoTraffic: false, hiring: true, reviews: true, social: true, fundingNews: true, crmDealData: false },
  { name: "Seeto", pricing: true, features: true, seoTraffic: true, hiring: false, reviews: false, social: false, fundingNews: false, crmDealData: false },
  { name: "Analook", pricing: true, features: false, seoTraffic: true, hiring: false, reviews: false, social: true, fundingNews: false, crmDealData: false },
  { name: "Outmano", pricing: true, features: true, seoTraffic: true, hiring: true, reviews: false, social: false, fundingNews: false, crmDealData: false },
  { name: "Steve", pricing: true, features: true, seoTraffic: false, hiring: false, reviews: true, social: true, fundingNews: false, crmDealData: true },
];
