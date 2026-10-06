// Working name and shared copy for the "use Ripplewatch inside your AI
// assistant" offering (an MCP server, see /api/mcp). One place so the pricing
// card, /connect page, homepage, onboarding and FAQ can't drift, and so a
// rename is a one-line change.

export const CONNECT_NAME = "Ripplewatch Connect";
export const CONNECT_TAGLINE = "Your AI competitive intelligence analyst, built into Claude or ChatGPT.";
export const CONNECT_MCP_URL = "https://www.ripplewatch.ai/api/mcp";

export const CONNECT_ASSISTANTS = ["Claude", "ChatGPT", "Cursor", "Something else"] as const;
export type ConnectAssistant = (typeof CONNECT_ASSISTANTS)[number];

// What it actually does today, matching the tools the MCP server exposes.
// The fuller phrasing used on /connect, which has room for it.
export const CONNECT_FEATURES = [
  "Ask about your competitors in plain language, answered against your positioning",
  "A weekly briefing of what changed and what it means for your deals",
  "Log won and lost deals and customer feedback by just telling your assistant",
  "It tells you what to share next to make answers sharper",
  "Unlimited teammates on one account",
  "Sign in once, disconnect any time",
] as const;

// Same list, tightened for the pricing card: same count as the Dashboard
// tier's own card features (see tiers.ts) so the two cards land at the same
// height without empty space or a stretched one.
export const CONNECT_PRICING_FEATURES = [
  "Ask about competitors in plain language",
  "A weekly briefing on what changed and why",
  "Log deals and feedback by just telling it",
  "Gets sharper the more you use it",
  "Unlimited teammates, one account",
  "Pay only for what you use, never on credit",
] as const;

// Example prompts for the marketing page. Each maps to something the tools
// really do, so nothing here promises a capability that isn't built.
export const CONNECT_EXAMPLES = [
  "What changed with my competitors this week, and what should I worry about?",
  "Should we respond to Acme's new pricing?",
  "We just lost a deal to Acme on price. Log it.",
  "Which competitor is heating up fastest right now?",
] as const;

// Plain-language answers to the four questions people (and answer engines)
// ask first. Rendered on the homepage and /connect, and written to be quoted
// as they stand, so each one is a complete sentence or two that names the
// product. Prices come from connect-pricing.ts at the call site, not here.
export const CONNECT_QUICK_ANSWERS = [
  {
    question: "What is Ripplewatch Connect?",
    answer:
      "An AI competitive intelligence analyst that works inside Claude and other AI assistants over MCP. It watches your competitors' pricing, hiring, press and product changes, and scores each one against your positioning and your win/loss history.",
  },
  {
    question: "Who is it for?",
    answer:
      "Product marketing, sales and revenue teams at B2B software companies that track a handful of competitors and want a straight answer when someone asks whether a competitor's move matters.",
  },
  {
    question: "How does it connect?",
    answer:
      "Add https://www.ripplewatch.ai/api/mcp as a custom connector in Claude or another assistant that supports remote MCP servers, then sign in and approve. ChatGPT works through its developer mode, which is in beta.",
  },
] as const;

// Every message a Connect account can receive, in one place so the Settings
// card, the setup guide and the assistant's "how to use Ripplewatch" answer
// can't drift apart from what the crons actually send. `control` says how a
// person turns it off.
export const CONNECT_NOTIFICATIONS = [
  {
    id: "daily",
    cadence: "Daily",
    name: "Alerts for important changes",
    when: "Only when something scores High relevance, never on a quiet day. With Slack connected they post to your channel as they happen. Without Slack you get one email a day.",
    control: "Switch in Settings. With Slack, turn on Also email me to get the daily email too.",
  },
  {
    id: "weekly",
    cadence: "Weekly",
    name: "Weekly briefing",
    when: "The week's verdict. With Slack connected it posts to your channel at the day and time you choose. Without Slack it's emailed on Mondays. Skipped on a quiet week.",
    control: "Always on. With Slack, turn on Also email me to get the Monday email too. You can ask your assistant for the same briefing any time.",
  },
  {
    id: "monthly",
    cadence: "Monthly",
    name: "Monthly recap",
    when: "The 1st of each month: what changed in the last 30 days, who is heating up, deal results, and one thing that would sharpen next month. Posts to Slack if connected, otherwise emailed. Starts after your account is three weeks old.",
    control: "Switch in Settings, or the link in the email.",
  },
  {
    id: "account",
    cadence: "As needed",
    name: "Balance and billing alerts",
    when: "When your usage balance runs low, a reload fails, or answers are paused. Always emailed to the account owner.",
    control: "Always on.",
  },
] as const;
