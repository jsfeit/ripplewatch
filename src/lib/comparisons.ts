// Factual claims here should trace back to public research (pricing pages,
// product marketing, review sites) — these are comparison pages, not
// disparagement, so "what they do well" has to be genuinely true or the
// whole page loses credibility. Update if a competitor's product changes.

export type ComparisonEntry = {
  slug: string;
  name: string;
  domain: string;
  tagline: string;
  whatTheyDoWell: string;
  theirMechanism: string;
  differentiator: string;
};

export const COMPARISONS: ComparisonEntry[] = [
  {
    slug: "caelian",
    name: "Caelian",
    domain: "caelian.ai",
    tagline:
      "A live dashboard and daily brief built around a P0/P1/P2 priority framework, aimed at CEOs rather than analysts.",
    whatTheyDoWell:
      "Caelian's priority framework is genuinely useful triage: a P0/P1/P2 threshold that suppresses everything below it from the daily brief, so a CEO gets one glance at what's actually urgent instead of a full feed. It also leans predictive: hiring velocity and regulatory filings are treated as leading indicators rather than waiting for a launch or a press release to confirm a move.",
    theirMechanism: "a P0/P1/P2 priority framework",
    differentiator:
      "The priority level itself is generic severity: the same kind of signal gets the same P0/P1/P2 rating regardless of whose business is reading it. Ripplewatch's relevance score is computed against your specific positioning, ICP, and the actual reasons your deals were lost or customers churned. The same signal can be High for one company and Low for another, because it's scored against what matters to that business, not a general urgency scale.",
  },
  {
    slug: "kompyte",
    name: "Kompyte",
    domain: "kompyte.com",
    tagline:
      "An AI battlecard platform (owned by Semrush) that scrapes competitor sites, social, reviews, and job posts daily to keep sales collateral current.",
    whatTheyDoWell:
      "Auto-updating battlecards are a genuinely useful default: sales teams get maintained competitive collateral without a PM manually refreshing slides every quarter. The CRM tie-in (Salesforce/HubSpot) that ties win/loss outcomes back to a specific competitor is a real integration strength, and Semrush's backing brings SEO/traffic data most standalone tools don't have.",
    theirMechanism: "daily scraping feeding auto-generated, always-current battlecards",
    differentiator:
      "A battlecard is the same battlecard for every rep and every deal — comprehensive, but it doesn't rank which of today's changes actually matters right now versus which is background noise. Ripplewatch scores each finding against your specific positioning and real win/loss history, so a pricing change that's dangerous for one company can be irrelevant for another.",
  },
  {
    slug: "contify",
    name: "Contify",
    domain: "contify.com",
    tagline:
      "An AI market-intelligence platform aggregating over a million curated sources into role-based dashboards and a natural-language research assistant.",
    whatTheyDoWell:
      "The sheer breadth of curated source coverage — news, filings, job boards, review sites — is a real advantage for research-heavy analyst teams who need to answer open-ended questions, not just watch for alerts. Its \"Ask Athena\" assistant lets you query that corpus directly instead of digging through a feed yourself.",
    theirMechanism: "a curated multi-source corpus plus a natural-language Q&A layer",
    differentiator:
      "Contify is built to answer whatever you ask it — which is powerful, but it means the underlying prioritization is breadth-based, not scored against your specific win/loss reasons. Ripplewatch flips that: every finding already comes with a relevance score computed against your positioning and ICP, so you're not the one deciding what to ask about.",
  },
  {
    slug: "similarweb",
    name: "Similarweb",
    domain: "similarweb.com",
    tagline:
      "A web-traffic and digital-market-intelligence platform estimating competitor traffic, channel mix, and audience overlap across 190 countries.",
    whatTheyDoWell:
      "Similarweb's category-level traffic benchmarking, built on a genuinely large multi-source data model (panels, ISPs, crawlers), is best-in-class for understanding a competitor's channel mix — how much of their traffic is SEO versus paid versus social. It's a different tool for a different job than most others on this list, and it's a strong one at that job.",
    theirMechanism: "modeled website traffic and channel-mix analytics",
    differentiator:
      "Similarweb tells you how much traffic a competitor gets and where it's from — it doesn't tell you whether a specific pricing change, hire, or funding round matters to your deals. Ripplewatch is built around scored, actionable findings tied to your own positioning and win/loss history, not traffic analytics.",
  },
  {
    slug: "owler",
    name: "Owler",
    domain: "owler.com",
    tagline:
      "A crowdsourced database of 20M+ company profiles with a \"Competitive Graph\" mapping rivals, revenue estimates, and news alerts — acquired by Meltwater in 2021.",
    whatTheyDoWell:
      "The scale of crowdsourced coverage is genuinely useful for discovering and mapping competitors broadly, especially in categories where you don't already have a short, known list. Its news-alert layer is a reasonable way to stay aware of a wide set of companies at once.",
    theirMechanism: "crowdsourced company profiles plus broad news alerts",
    differentiator:
      "Because profile data is community-edited, accuracy varies company to company — a well-documented tradeoff of the crowdsourcing model, not a knock on the idea. And news alerts, however broad, aren't scored for relevance to your specific positioning: Ripplewatch tracks a focused list of real competitors and scores every finding against your own ICP and win/loss reasons.",
  },
  {
    slug: "parano-ai",
    name: "Parano.ai",
    domain: "parano.ai",
    tagline:
      "An AI competitive-intelligence tool delivering weekly synthesized summaries of pricing, product, messaging, reviews, hiring, and funding via email, Slack, or Teams.",
    whatTheyDoWell:
      "Bundling broad signal coverage into one weekly digest is a sensible default for a team that doesn't want to build monitoring themselves — it's a reasonable way to stay roughly current without checking multiple sources.",
    theirMechanism: "a weekly AI-synthesized digest across several signal types",
    differentiator:
      "A weekly digest bundles everything into one message without ranking it — there's no way to tell which item in this week's summary is the one that actually matters to a deal you're in right now. Ripplewatch scores each individual finding for relevance as it happens, rather than batching everything into a single weekly read.",
  },
  {
    slug: "compttr",
    name: "Compttr",
    domain: "compttr.com",
    tagline:
      "An on-demand tool that synthesizes G2, Capterra, and Trustpilot review data into a competitive report in about 60 seconds.",
    whatTheyDoWell:
      "The narrow focus is a strength, not a limitation: fast, cheap review-sentiment synthesis is genuinely useful for a quick gut-check before a call, without committing to an ongoing subscription.",
    theirMechanism: "on-demand review-site sentiment synthesis",
    differentiator:
      "It's a snapshot of review sentiment at one point in time, not continuous tracking — it won't tell you about a pricing change or a new hire next week, and it isn't scored against your own win/loss data. Ripplewatch monitors continuously and scores every finding, review sentiment or otherwise, against your specific positioning.",
  },
  {
    slug: "competely",
    name: "Competely",
    domain: "competely.ai",
    tagline:
      "Enter a competitor's URL and get an AI-generated, source-linked comparison table covering 100+ data points in minutes, with ongoing monitoring emails after.",
    whatTheyDoWell:
      "Generating a sourced comparison table — every claim linked back to where it came from — in minutes rather than hours of manual research is a genuinely fast way to get oriented on a new competitor.",
    theirMechanism: "an AI-generated, source-linked feature/pricing comparison table",
    differentiator:
      "A comparison table is a snapshot of features and pricing as they stand today — useful for onboarding onto a new competitor, but not a relevance-ranked feed of what changed and why it matters to your specific deals. Ripplewatch is built for the ongoing question, not the one-time snapshot.",
  },
  {
    slug: "seeto",
    name: "Seeto",
    domain: "seeto.ai",
    tagline:
      "A one-time competitive analysis tool: from one URL, it profiles up to 15 competitors across features, pricing, SEO, and positioning, with battlecard and ad-intelligence add-ons.",
    whatTheyDoWell:
      "Covering up to 15 competitors from a single starting URL is a genuinely fast way to get broad first-pass coverage when you don't yet know exactly who you're up against.",
    theirMechanism: "a one-time, wide-competitor-set analysis from a single URL",
    differentiator:
      "It's a one-time analysis rather than continuous monitoring, so it can't tell you what changed after the report was generated. Ripplewatch tracks a focused competitor set continuously and scores each new finding for relevance, rather than producing a single point-in-time snapshot.",
  },
  {
    slug: "analook",
    name: "Analook",
    domain: "analook.com",
    tagline:
      "A fast, cheap AI \"teardown\" tool combining 15+ signals — SEO, social, Product Hunt, GitHub, Wayback Machine history, pricing — into a single strategic verdict, with an MCP server for use inside Claude or Cursor.",
    whatTheyDoWell:
      "The low price point and speed (a single report in about 60 seconds) make it a genuinely accessible first look at a competitor, and the MCP server integration is a smart distribution choice for technical teams already working inside AI tools.",
    theirMechanism: "a one-time, multi-signal AI teardown and verdict",
    differentiator:
      "It's a snapshot verdict generated once, not an ongoing monitor — there's no way to know what changed after the teardown ran. Ripplewatch continuously tracks your competitors and scores every new finding against your positioning, rather than producing a single verdict at one point in time.",
  },
  {
    slug: "outmano",
    name: "Outmano",
    domain: "outmano.com",
    tagline:
      "AI agents that crawl pricing, SEO, content, roadmap, reviews, hiring, and news per competitor for B2B SaaS SMBs, positioned as the affordable alternative to enterprise tools like Klue and Crayon.",
    whatTheyDoWell:
      "Bringing broad, per-competitor agent coverage to SMB pricing (versus the five-figure annual contracts enterprise tools typically require) is a fair and real value proposition, and fast setup per competitor lowers the barrier to actually using it.",
    theirMechanism: "per-competitor crawling agents feeding a weekly digest and Slack alerts",
    differentiator:
      "Broad coverage synthesized into a digest still runs into the same-severity problem: a competitor's SEO change reads with the same urgency as their pricing change, regardless of which one actually threatens a deal you're in. Ripplewatch scores each finding against your specific positioning and win/loss history instead of a flat alert stream.",
  },
  {
    slug: "playwise-hq",
    name: "Playwise HQ",
    domain: "playwisehq.com",
    tagline:
      "An AI-native battlecard platform that combines LLM-driven research with intel sales reps log directly from live deal conversations, plus win/loss learning.",
    whatTheyDoWell:
      "Capturing competitive intel from what reps actually hear in real deals — not just external scraping — is a genuinely distinct mechanism worth crediting; it surfaces the kind of nuance (an objection, a specific competitor claim in a live deal) that pure automation misses.",
    theirMechanism: "rep-sourced field intel combined with LLM research, searchable from Slack",
    differentiator:
      "Rep-sourced intel is a real strength for capturing what happens inside deals, but it doesn't independently score external signals — a competitor's pricing change, a funding round, a hiring spike — the way Ripplewatch does. The two mechanisms are complementary more than substitutes: one captures what your team hears, the other scores what's happening outside your deals.",
  },
  {
    slug: "watchmycompetitor",
    name: "WatchMyCompetitor",
    domain: "watchmycompetitor.com",
    tagline:
      "A UK-based market-intelligence platform combining AI monitoring of competitor websites, pricing, social, and financials with human-analyst curation.",
    whatTheyDoWell:
      "The hybrid AI-plus-human-analyst model is a genuine differentiator versus fully-automated tools: a person reviewing what the AI surfaces can catch nuance and context that pure automation misses, especially for less structured signals.",
    theirMechanism: "AI monitoring reviewed and curated by human analysts",
    differentiator:
      "Human curation adds real judgment, but also cost and lag compared to fully-automated scoring, and it isn't tuned to your specific positioning or ICP — the analyst is applying general judgment, not your company's own definition of what matters. Ripplewatch's relevance score is computed against your own positioning and win/loss history specifically, and updates as fast as the underlying signal does.",
  },
  {
    slug: "competitors-app",
    name: "Competitors App",
    domain: "competitors.app",
    tagline:
      "Monitors competitors' marketing channels — website changes, social media, ads, SEO rankings, and even their own email/newsletter lifecycle — via dashboards and alerts.",
    whatTheyDoWell:
      "Actually signing up for a competitor's trials and newsletters to see their real lifecycle marketing emails is a genuinely clever, distinct mechanism that most tools on this list don't do — it's real visibility into how a competitor nurtures its own leads.",
    theirMechanism: "marketing-channel monitoring, including subscribing to competitors' own email flows",
    differentiator:
      "It's strong on marketing-channel visibility specifically, but that's channel monitoring, not relevance-scored competitive intelligence tied to why deals are actually won or lost. Ripplewatch scores every finding — marketing moves included — against your specific positioning and real win/loss reasons, not just channel activity.",
  },
  {
    slug: "industrylens",
    name: "IndustryLens",
    domain: "industry-lens.com",
    tagline:
      "Monitors a broad set of sources — pricing pages, changelogs, ads, reviews, social, hiring, news — for B2B SaaS competitors, delivering a weekly sourced intelligence briefing, with an MCP server for AI-tool workflows.",
    whatTheyDoWell:
      "Linking every claim back to its source is a real trust-building choice, and the MCP server integration for querying live inside Claude or Cursor is a specific, checkable, relatively novel feature among tools like this.",
    theirMechanism: "broad, sourced monitoring delivered as a weekly briefing",
    differentiator:
      "A sourced weekly briefing is trustworthy, but the prioritization inside it is breadth-first and generic — every account reading the same briefing sees the same emphasis. Ripplewatch scores each finding against your own positioning and win/loss history, so the same event can rank differently for two different companies.",
  },
  {
    slug: "valona-intelligence",
    name: "Valona Intelligence",
    domain: "valonaintelligence.com",
    tagline:
      "An enterprise market- and competitive-intelligence platform (formerly M-Brain, founded 1999) monitoring 200,000+ verified sources with AI plus expert analyst curation, recognized in Gartner and Forrester coverage.",
    whatTheyDoWell:
      "A quarter-century operating history and independent analyst recognition (Gartner, Forrester) is real, verifiable credibility at enterprise scale — not every vendor on this list can point to that. Its chemicals-industry specialization is a genuine, deep niche strength most competitive-intelligence tools don't attempt.",
    theirMechanism: "large-scale source monitoring with human analyst curation, built for enterprise and regulatory intelligence",
    differentiator:
      "Valona is built for large-enterprise engagements — regulatory and market intelligence at a scale and price point that assumes a dedicated analyst relationship, not a self-serve tool a smaller team signs up for directly. Ripplewatch's relevance scoring is built to be self-serve from day one, tuned to your own positioning without an analyst engagement in between.",
  },
];

export function getComparison(slug: string): ComparisonEntry | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}
