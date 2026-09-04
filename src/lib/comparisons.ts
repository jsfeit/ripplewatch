// Factual claims here should trace back to public research (pricing pages,
// product marketing, review sites): these are comparison pages, not
// disparagement, so "what they do well" has to be genuinely true or the
// whole page loses credibility. Update if a competitor's product changes.
//
// whatTheyDoWell/differentiator render only on /compare/[slug] (paired with
// a comparison table). switchGain/switchConsider render only on
// /alternatives/[slug] and are framed around switching, not restated from
// the /compare copy — the two page types need to say different things about
// the same competitor, not the same paragraph under a different heading.

export type ComparisonEntry = {
  slug: string;
  name: string;
  domain: string;
  tagline: string;
  whatTheyDoWell: string;
  theirMechanism: string;
  differentiator: string;
  bestFor: string;
  howPrioritized: string;
  switchGain: string;
  switchConsider: string;
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
    bestFor: "CEOs who want a single daily glance, not a feed to monitor",
    howPrioritized: "Generic P0/P1/P2 severity, same for every company",
    switchGain:
      "You get relevance computed against your own positioning instead of a general P0/P1/P2 severity scale, so a signal isn't automatically urgent for you just because it was urgent for someone else's business. Every score also comes with the reasoning attached, not just a priority label.",
    switchConsider:
      "Caelian's predictive lean, treating hiring and filings as leading indicators before a launch confirms them, is a genuine feature Ripplewatch doesn't try to replicate. If that predictive angle is what you value most, weigh it against personalized scoring before switching.",
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
      "A battlecard is the same battlecard for every rep and every deal: comprehensive, but it doesn't rank which of today's changes actually matters right now versus which is background noise. Ripplewatch scores each finding against your specific positioning and real win/loss history, so a pricing change that's dangerous for one company can be irrelevant for another.",
    bestFor: "Sales teams who need auto-updating battlecards synced to their CRM",
    howPrioritized: "One battlecard for every rep and every deal",
    switchGain:
      "Every finding arrives pre-scored for your specific positioning and win/loss history, instead of a battlecard that reads the same for every rep on every deal. You stop being the one who has to judge which of today's updates is actually urgent.",
    switchConsider:
      "If your team leans on CRM-tied battlecards and Semrush's SEO/traffic data as part of a broader sales-enablement motion, that combination isn't something switching to Ripplewatch replaces outright.",
  },
  {
    slug: "contify",
    name: "Contify",
    domain: "contify.com",
    tagline:
      "An AI market-intelligence platform aggregating over a million curated sources into role-based dashboards and a natural-language research assistant.",
    whatTheyDoWell:
      "The sheer breadth of curated source coverage (news, filings, job boards, review sites) is a real advantage for research-heavy analyst teams who need to answer open-ended questions, not just watch for alerts. Its \"Ask Athena\" assistant lets you query that corpus directly instead of digging through a feed yourself.",
    theirMechanism: "a curated multi-source corpus plus a natural-language Q&A layer",
    differentiator:
      "Contify is built to answer whatever you ask it, which is powerful, but it means the underlying prioritization is breadth-based, not scored against your specific win/loss reasons. Ripplewatch flips that: every finding already comes with a relevance score computed against your positioning and ICP, so you're not the one deciding what to ask about.",
    bestFor: "Analyst teams doing open-ended research across a huge curated corpus",
    howPrioritized: "Breadth-based; you ask, it answers",
    switchGain:
      "Instead of deciding what to ask a research assistant, you get findings that already arrive with a relevance score attached, computed against your positioning and ICP. Less digging, less framing your own queries.",
    switchConsider:
      "If your job is genuinely open-ended research, not just watching for what matters to your existing deals, Contify's breadth and \"Ask Athena\" query layer covers ground a focused, scored feed isn't built for.",
  },
  {
    slug: "similarweb",
    name: "Similarweb",
    domain: "similarweb.com",
    tagline:
      "A web-traffic and digital-market-intelligence platform estimating competitor traffic, channel mix, and audience overlap across 190 countries.",
    whatTheyDoWell:
      "Similarweb's category-level traffic benchmarking, built on a genuinely large multi-source data model (panels, ISPs, crawlers), is best-in-class for understanding a competitor's channel mix: how much of their traffic is SEO versus paid versus social. It's a different tool for a different job than most others on this list, and it's a strong one at that job.",
    theirMechanism: "modeled website traffic and channel-mix analytics",
    differentiator:
      "Similarweb tells you how much traffic a competitor gets and where it's from, but it doesn't tell you whether a specific pricing change, hire, or funding round matters to your deals. Ripplewatch is built around scored, actionable findings tied to your own positioning and win/loss history, not traffic analytics.",
    bestFor: "Understanding a competitor's traffic and channel mix specifically",
    howPrioritized: "Not scored, traffic and channel analytics only",
    switchGain:
      "Ripplewatch tells you whether a pricing change, hire, or funding round actually threatens a deal you're in, which traffic and channel-mix data alone can't answer.",
    switchConsider:
      "Similarweb isn't really a competing tool for what Ripplewatch does. If channel-mix and traffic benchmarking is the actual job, it's worth keeping alongside Ripplewatch rather than replacing it.",
  },
  {
    slug: "owler",
    name: "Owler",
    domain: "owler.com",
    tagline:
      "A crowdsourced database of 20M+ company profiles with a \"Competitive Graph\" mapping rivals, revenue estimates, and news alerts, acquired by Meltwater in 2021.",
    whatTheyDoWell:
      "The scale of crowdsourced coverage is genuinely useful for discovering and mapping competitors broadly, especially in categories where you don't already have a short, known list. Its news-alert layer is a reasonable way to stay aware of a wide set of companies at once.",
    theirMechanism: "crowdsourced company profiles plus broad news alerts",
    differentiator:
      "Because profile data is community-edited, accuracy varies company to company: a well-documented tradeoff of the crowdsourcing model, not a knock on the idea. And news alerts, however broad, aren't scored for relevance to your specific positioning: Ripplewatch tracks a focused list of real competitors and scores every finding against your own ICP and win/loss reasons.",
    bestFor: "Broadly discovering and mapping competitors you don't already have a short list for",
    howPrioritized: "Broad news alerts, not scored for relevance",
    switchGain:
      "You move from a wide, crowdsourced set of profiles and unscored news alerts to a focused competitor list where every finding is scored against your own ICP and win/loss reasons, so relevance stops varying company to company.",
    switchConsider:
      "If discovery, finding competitors you didn't know about, is still the job, Owler's crowdsourced scale is worth keeping around even after you add Ripplewatch for the companies you're actually tracking closely.",
  },
  {
    slug: "parano-ai",
    name: "Parano.ai",
    domain: "parano.ai",
    tagline:
      "An AI competitive-intelligence tool delivering weekly synthesized summaries of pricing, product, messaging, reviews, hiring, and funding via email, Slack, or Teams.",
    whatTheyDoWell:
      "Bundling broad signal coverage into one weekly digest is a sensible default for a team that doesn't want to build monitoring themselves: it's a reasonable way to stay roughly current without checking multiple sources.",
    theirMechanism: "a weekly AI-synthesized digest across several signal types",
    differentiator:
      "A weekly digest bundles everything into one message without ranking it: there's no way to tell which item in this week's summary is the one that actually matters to a deal you're in right now. Ripplewatch scores each individual finding for relevance as it happens, rather than batching everything into a single weekly read.",
    bestFor: "Teams who want one broad weekly summary and don't mind reading past the noise",
    howPrioritized: "Everything bundled into one weekly digest, unranked",
    switchGain:
      "Findings get scored and delivered as they happen instead of batched into one weekly digest, so the one item that actually matters to a live deal doesn't have to wait for Friday's summary or get lost among the rest.",
    switchConsider:
      "If a once-a-week cadence is genuinely enough for your team and you like having everything in one message, that simplicity is a real tradeoff against Ripplewatch's continuous, individually scored updates.",
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
      "It's a snapshot of review sentiment at one point in time, not continuous tracking: it won't tell you about a pricing change or a new hire next week, and it isn't scored against your own win/loss data. Ripplewatch monitors continuously and scores every finding, review sentiment or otherwise, against your specific positioning.",
    bestFor: "A fast, one-time gut-check on review sentiment before a call",
    howPrioritized: "One-time snapshot, not scored against your data",
    switchGain:
      "You get continuous tracking instead of a single snapshot, and every finding, review sentiment included, is scored against your own positioning rather than left as an unscored one-time report.",
    switchConsider:
      "For a quick pre-call check with no ongoing subscription, Compttr's 60-second, on-demand model is genuinely cheaper and simpler than an always-on monitor if that's really all you need.",
  },
  {
    slug: "competely",
    name: "Competely",
    domain: "competely.ai",
    tagline:
      "Enter a competitor's URL and get an AI-generated, source-linked comparison table covering 100+ data points in minutes, with ongoing monitoring emails after.",
    whatTheyDoWell:
      "Generating a sourced comparison table (every claim linked back to where it came from) in minutes rather than hours of manual research is a genuinely fast way to get oriented on a new competitor.",
    theirMechanism: "an AI-generated, source-linked feature/pricing comparison table",
    differentiator:
      "A comparison table is a snapshot of features and pricing as they stand today, useful for onboarding onto a new competitor, but not a relevance-ranked feed of what changed and why it matters to your specific deals. Ripplewatch is built for the ongoing question, not the one-time snapshot.",
    bestFor: "Getting oriented fast on a brand-new competitor",
    howPrioritized: "Feature/pricing snapshot, not relevance-ranked",
    switchGain:
      "Instead of a one-time, source-linked snapshot of features and pricing, you get an ongoing, relevance-ranked feed of what changes after that first snapshot, and why it matters to your specific deals.",
    switchConsider:
      "If you mainly need the fast initial-orientation table Competely generates in minutes, that one-time research step is still worth doing first, even if Ripplewatch becomes the ongoing monitor afterward.",
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
    bestFor: "Broad first-pass coverage across up to 15 competitors from one URL",
    howPrioritized: "One-time report, not continuously scored",
    switchGain:
      "You trade a one-time report for continuous monitoring of a focused competitor set, so you find out what changed after the report, not just what was true the day it ran.",
    switchConsider:
      "If you genuinely don't know yet who your real competitors are, Seeto's wide first-pass sweep is a reasonable way to narrow that list before committing to ongoing tracking with Ripplewatch.",
  },
  {
    slug: "analook",
    name: "Analook",
    domain: "analook.com",
    tagline:
      "A fast, cheap AI \"teardown\" tool combining 15+ signals (SEO, social, Product Hunt, GitHub, Wayback Machine history, pricing) into a single strategic verdict, with an MCP server for use inside Claude or Cursor.",
    whatTheyDoWell:
      "The low price point and speed (a single report in about 60 seconds) make it a genuinely accessible first look at a competitor, and the MCP server integration is a smart distribution choice for technical teams already working inside AI tools.",
    theirMechanism: "a one-time, multi-signal AI teardown and verdict",
    differentiator:
      "It's a snapshot verdict generated once, not an ongoing monitor: there's no way to know what changed after the teardown ran. Ripplewatch continuously tracks your competitors and scores every new finding against your positioning, rather than producing a single verdict at one point in time.",
    bestFor: "A cheap, fast first look at a single competitor, especially for technical teams already in Claude or Cursor",
    howPrioritized: "One-time verdict, not an ongoing score",
    switchGain:
      "A single verdict generated once becomes an ongoing monitor: you find out what changed after the teardown ran, scored against your own positioning instead of a generic strategic verdict.",
    switchConsider:
      "If speed and price are the priority for a one-off look, and you're already working inside an MCP-connected AI tool, Analook's teardown is a genuinely low-cost way to get oriented before committing to continuous tracking.",
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
    bestFor: "SMB teams who want Klue/Crayon-style coverage without the enterprise price tag",
    howPrioritized: "Flat digest, every change reads the same urgency",
    switchGain:
      "Findings get scored against your specific positioning and win/loss history instead of arriving in a flat digest where an SEO change reads with the same urgency as a pricing change.",
    switchConsider:
      "Outmano's per-competitor agent coverage at SMB pricing is a real value proposition if broad coverage at low cost matters more to you than personalized relevance scoring.",
  },
  {
    slug: "playwise-hq",
    name: "Playwise HQ",
    domain: "playwisehq.com",
    tagline:
      "An AI-native battlecard platform that combines LLM-driven research with intel sales reps log directly from live deal conversations, plus win/loss learning.",
    whatTheyDoWell:
      "Capturing competitive intel from what reps actually hear in real deals, not just external scraping, is a genuinely distinct mechanism worth crediting; it surfaces the kind of nuance (an objection, a specific competitor claim in a live deal) that pure automation misses.",
    theirMechanism: "rep-sourced field intel combined with LLM research, searchable from Slack",
    differentiator:
      "Rep-sourced intel is a real strength for capturing what happens inside deals, but it doesn't independently score external signals (a competitor's pricing change, a funding round, a hiring spike) the way Ripplewatch does. The two mechanisms are complementary more than substitutes: one captures what your team hears, the other scores what's happening outside your deals.",
    bestFor: "Sales teams who want rep-sourced field intel alongside AI research",
    howPrioritized: "Rep-logged intel; external signals aren't independently scored",
    switchGain:
      "You add independent scoring of external signals, like a pricing change or a hiring spike, that rep-sourced intel alone doesn't cover, since it depends on your team happening to hear about it in a live deal.",
    switchConsider:
      "Playwise's rep-logged intel captures nuance from actual deal conversations that no automated tool, Ripplewatch included, can fully replace; the two are genuinely complementary rather than substitutes.",
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
      "Human curation adds real judgment, but also cost and lag compared to fully-automated scoring, and it isn't tuned to your specific positioning or ICP: the analyst is applying general judgment, not your company's own definition of what matters. Ripplewatch's relevance score is computed against your own positioning and win/loss history specifically, and updates as fast as the underlying signal does.",
    bestFor: "Teams who want a human analyst's judgment layered on top of AI monitoring",
    howPrioritized: "Human-analyst judgment, not tuned to your ICP",
    switchGain:
      "You get scoring computed against your own positioning and win/loss history that updates as fast as the underlying signal does, without the added cost and lag of a human-curation step.",
    switchConsider:
      "If nuanced human judgment on less-structured signals is worth the added cost and lag to you, WatchMyCompetitor's analyst layer is a genuine tradeoff to weigh against faster, fully-automated scoring.",
  },
  {
    slug: "competitors-app",
    name: "Competitors App",
    domain: "competitors.app",
    tagline:
      "Monitors competitors' marketing channels (website changes, social media, ads, SEO rankings, and even their own email/newsletter lifecycle) via dashboards and alerts.",
    whatTheyDoWell:
      "Actually signing up for a competitor's trials and newsletters to see their real lifecycle marketing emails is a genuinely clever, distinct mechanism that most tools on this list don't do: it's real visibility into how a competitor nurtures its own leads.",
    theirMechanism: "marketing-channel monitoring, including subscribing to competitors' own email flows",
    differentiator:
      "It's strong on marketing-channel visibility specifically, but that's channel monitoring, not relevance-scored competitive intelligence tied to why deals are actually won or lost. Ripplewatch scores every finding, marketing moves included, against your specific positioning and real win/loss reasons, not just channel activity.",
    bestFor: "Deep visibility into a competitor's marketing channels and lifecycle emails",
    howPrioritized: "Channel activity tracked, not relevance-scored",
    switchGain:
      "Every finding, marketing moves included, gets scored against your specific positioning and real win/loss reasons, instead of being reported as channel activity with no relevance judgment attached.",
    switchConsider:
      "Competitors App's trick of actually subscribing to a competitor's own trials and newsletters is a genuinely clever way to see their lifecycle marketing that switching to Ripplewatch wouldn't replicate on its own.",
  },
  {
    slug: "industrylens",
    name: "IndustryLens",
    domain: "industry-lens.com",
    tagline:
      "Monitors a broad set of sources (pricing pages, changelogs, ads, reviews, social, hiring, news) for B2B SaaS competitors, delivering a weekly sourced intelligence briefing, with an MCP server for AI-tool workflows.",
    whatTheyDoWell:
      "Linking every claim back to its source is a real trust-building choice, and the MCP server integration for querying live inside Claude or Cursor is a specific, checkable, relatively novel feature among tools like this.",
    theirMechanism: "broad, sourced monitoring delivered as a weekly briefing",
    differentiator:
      "A sourced weekly briefing is trustworthy, but the prioritization inside it is breadth-first and generic: every account reading the same briefing sees the same emphasis. Ripplewatch scores each finding against your own positioning and win/loss history, so the same event can rank differently for two different companies.",
    bestFor: "Teams who want every claim in a briefing linked back to its source",
    howPrioritized: "Breadth-first briefing, same emphasis for every account",
    switchGain:
      "Instead of a weekly briefing where every account sees the same breadth-first emphasis, findings are scored against your own positioning and win/loss history, so the same event can rank differently for two different companies.",
    switchConsider:
      "IndustryLens's sourced weekly briefing and MCP server integration are genuinely useful if a once-a-week, fully-cited format is what your team actually wants to read.",
  },
  {
    slug: "rivalwatch",
    name: "RivalWatch",
    domain: "rivalwatch.online",
    tagline:
      "A weekly snapshot-diff tool for small B2B SaaS teams: it re-crawls each tracked competitor's pages every week, compares the snapshot to the one before, and emails an AI-written explanation of what changed.",
    whatTheyDoWell:
      "The weekly cadence is genuinely simple to reason about: sign up, add competitor URLs, and a digest lands every Monday morning with no ongoing setup. At $29/month, it's a low-commitment way for a solo founder or small team to start watching a handful of competitors without evaluating a bigger platform first.",
    theirMechanism: "weekly page-snapshot diffing across pricing, copy, features, and job postings",
    differentiator:
      "A once-a-week snapshot means a signal can sit for up to six days before anyone sees it, and every change lands in the same undifferentiated Monday digest regardless of how much it actually threatens your business. Ripplewatch scores each finding as it happens against your specific positioning and win/loss history, rather than batching everything into one weekly read.",
    bestFor: "Solo founders or small teams who want a cheap, once-a-week competitor snapshot",
    howPrioritized: "Weekly digest, no personalized scoring",
    switchGain:
      "You move from a once-a-week digest to alerts scored against your own positioning as they happen, so a signal doesn't sit for up to six days before anyone sees it.",
    switchConsider:
      "If a once-a-week, $29/mo digest is genuinely all the coverage you need and price is the primary constraint, RivalWatch's cost is hard to beat for that scope.",
  },
  {
    slug: "valona-intelligence",
    name: "Valona Intelligence",
    domain: "valonaintelligence.com",
    tagline:
      "An enterprise market- and competitive-intelligence platform (formerly M-Brain, founded 1999) monitoring 200,000+ verified sources with AI plus expert analyst curation, recognized in Gartner and Forrester coverage.",
    whatTheyDoWell:
      "A quarter-century operating history and independent analyst recognition (Gartner, Forrester) is real, verifiable credibility at enterprise scale: not every vendor on this list can point to that. Its chemicals-industry specialization is a genuine, deep niche strength most competitive-intelligence tools don't attempt.",
    theirMechanism: "large-scale source monitoring with human analyst curation, built for enterprise and regulatory intelligence",
    differentiator:
      "Valona is built for large-enterprise engagements: regulatory and market intelligence at a scale and price point that assumes a dedicated analyst relationship, not a self-serve tool a smaller team signs up for directly. Ripplewatch's relevance scoring is built to be self-serve from day one, tuned to your own positioning without an analyst engagement in between.",
    bestFor: "Large enterprises needing regulatory and market intelligence at scale, especially in chemicals",
    howPrioritized: "Enterprise analyst engagement, not self-serve scoring",
    switchGain:
      "Ripplewatch is self-serve from day one, so you get relevance scoring tuned to your own positioning without a dedicated analyst engagement or enterprise contract in between.",
    switchConsider:
      "If you're already working at the scale Valona is built for, its quarter-century operating history, analyst recognition, and chemicals-industry depth aren't things a self-serve tool replaces.",
  },
  {
    slug: "klue",
    name: "Klue",
    domain: "klue.com",
    tagline:
      "An enterprise competitive-intelligence platform built around a Compete Agent that continuously gathers intel, a Win-Loss Suite with AI-interviewed verified buyer interviews, and Ask Klue, a chat interface for querying competitive data on demand.",
    whatTheyDoWell:
      "The Win-Loss Suite's verified buyer interviews, including an AI interviewer for voice conversations, are a genuinely deep capability most competitive-intelligence tools don't attempt: real, structured feedback from actual buyers, not just internal rep opinions. Ask Klue's chat interface is a reasonable way to query competitive data without digging through a dashboard.",
    theirMechanism: "a continuously-running Compete Agent feeding deal-specific insight to reps, plus a separate verified buyer-interview product",
    differentiator:
      "Klue is built and priced for large enterprise sales organizations: pricing isn't published, deals are customized and sold through a sales cycle, and the buyer-interview product assumes a dedicated CI or enablement function running it. Ripplewatch is self-serve with published pricing from day one, built for a team that wants to start monitoring competitors this afternoon, not after a multi-week evaluation.",
    bestFor: "Large enterprise sales orgs that want verified buyer win-loss interviews alongside monitoring",
    howPrioritized: "Deal-specific insight pushed to reps; no published self-serve pricing or scoring tier",
    switchGain:
      "You get published, self-serve pricing and relevance scoring tied to your own positioning from day one, instead of a multi-week sales evaluation before you can see it working.",
    switchConsider:
      "Klue's verified buyer win-loss interviews, including an AI interviewer for voice conversations, are a genuinely deep capability Ripplewatch doesn't attempt to replicate; if that's the core need, it's worth the sales call.",
  },
  {
    slug: "crayon",
    name: "Crayon",
    domain: "crayon.co",
    tagline:
      "An enterprise competitive-intelligence platform combining automated competitor monitoring with battlecards deployed into Salesforce and Slack, plus Sparks, an AI feature that runs scheduled passes over competitor news, social activity, and PR.",
    whatTheyDoWell:
      "Deploying battlecards straight into Salesforce and Slack, where reps already work, is a genuinely practical distribution choice, and Sparks' scheduled passes over news, social, and PR give broad, automated coverage without a person doing that scanning manually.",
    theirMechanism: "automated monitoring paired with Salesforce/Slack-deployed battlecards and scheduled AI passes over public sources",
    differentiator:
      "Crayon, like Klue, doesn't publish pricing: deals are customized, sold through a sales cycle, and priced for teams that need dedicated implementation support, not a self-serve signup. Ripplewatch publishes its pricing and scores every finding against your specific positioning and win/loss history from the first day, without an enterprise sales process in between.",
    bestFor: "Enterprise sales teams who want automated battlecards live in Salesforce and Slack",
    howPrioritized: "Scheduled AI passes over public sources; no published self-serve pricing or personalized scoring",
    switchGain:
      "You get transparent, self-serve pricing and relevance scoring tied to your own positioning and win/loss history, without an enterprise sales cycle or custom-quoted contract first.",
    switchConsider:
      "If your team is already at the scale where dedicated implementation support and a Salesforce-embedded battlecard workflow matter more than self-serve simplicity, Crayon's enterprise-focused build is a real fit worth the sales conversation.",
  },
  {
    slug: "alphasense",
    name: "AlphaSense",
    domain: "alpha-sense.com",
    tagline:
      "An AI-powered search platform over 500+ million financial and business documents, built for investment banks, hedge funds, consulting firms, and large corporations doing market research, not day-to-day competitor monitoring.",
    whatTheyDoWell:
      "AI search over a genuinely massive curated corpus of financial filings, expert-call transcripts (through its Tegus acquisition), and analyst reports is a real, deep capability for research-heavy work: due diligence, market sizing, thesis validation. SuperAnalyst and Deep Research turn a broad question into a cited, synthesized answer instead of a pile of documents to read yourself.",
    theirMechanism: "AI search and synthesis across a licensed corpus of financial documents and expert-call transcripts",
    differentiator:
      "AlphaSense is a research tool you query when you have a question, not a system that watches your specific competitors and tells you when something changes. It doesn't score findings against your own positioning or win/loss history, and pricing isn't published, sold through a sales process aimed at financial services and enterprise research teams. Ripplewatch runs continuously against a defined competitor list and scores every finding against your business specifically, at self-serve pricing from day one.",
    bestFor: "Financial services and large-enterprise research teams doing deep due diligence and market analysis",
    howPrioritized: "Relevance ranking within a search query; no continuous per-competitor monitoring or personalized scoring",
    switchGain:
      "You get continuous monitoring of a defined competitor list with every finding scored against your own positioning and win/loss history, instead of a research tool you have to remember to go query, at self-serve pricing instead of an enterprise sales process.",
    switchConsider:
      "AlphaSense's depth of licensed financial documents and expert-call transcripts is real infrastructure Ripplewatch doesn't attempt to replicate; if your work is financial research or due diligence rather than ongoing competitor tracking, that depth is the actual point.",
  },
  {
    slug: "clozd",
    name: "Clozd",
    domain: "clozd.com",
    tagline:
      "A win/loss interview platform: human or AI-led conversations with actual buyers after a deal closes, built for revenue teams that want structured feedback on why deals were won or lost.",
    whatTheyDoWell:
      "Actually talking to buyers, whether through a live 30-minute call or an AI-led interview, surfaces context a CRM close-reason dropdown never captures: the real hesitations, the competitor that almost won, the moment the deal turned. That's a genuinely different and deeper source of signal than internally-logged reasons.",
    theirMechanism: "live or AI-led buyer interviews, structured into dashboards after each deal closes",
    differentiator:
      "Clozd's insight comes from a dedicated interview after the fact, requiring the buyer's time and cooperation, and pricing isn't published, sold through a quote process. Ripplewatch consolidates the win/loss reasons your team already logs in your CRM, continuously, and ties them into the same scoring that tracks competitor pricing, hiring, and news, at self-serve pricing from day one.",
    bestFor: "Revenue teams that want structured, interview-based buyer feedback after every deal",
    howPrioritized: "Deal-by-deal interview insight; no continuous competitor monitoring or automated relevance scoring",
    switchGain:
      "Your existing CRM win/loss reasons feed directly into the same relevance-scored system tracking competitor pricing, hiring, and news, continuously and at self-serve pricing, instead of a separate interview process that depends on buyer availability.",
    switchConsider:
      "A real buyer interview, especially Clozd's live, human-conducted calls, surfaces nuance a CRM dropdown reason never will; if that depth of qualitative feedback is what you need most, it's a genuinely different tool than Ripplewatch, not a straight substitute.",
  },
];

export function getComparison(slug: string): ComparisonEntry | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}
