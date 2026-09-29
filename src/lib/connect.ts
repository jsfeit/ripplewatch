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
