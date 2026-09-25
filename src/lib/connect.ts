// Working name and shared copy for the "use Ripplewatch inside your AI
// assistant" offering (an MCP server, see /api/mcp). One place so the pricing
// card, /connect page, homepage, onboarding and FAQ can't drift, and so a
// rename is a one-line change.

export const CONNECT_NAME = "Ripplewatch Connect";
export const CONNECT_TAGLINE = "Use Ripplewatch inside Claude or ChatGPT. No dashboard to check.";
export const CONNECT_MCP_URL = "https://www.ripplewatch.ai/api/mcp";

export const CONNECT_ASSISTANTS = ["Claude", "ChatGPT", "Cursor", "Something else"] as const;
export type ConnectAssistant = (typeof CONNECT_ASSISTANTS)[number];

// What it actually does today, matching the tools the MCP server exposes.
export const CONNECT_FEATURES = [
  "Ask about your competitors in plain language, answered against your positioning",
  "A weekly briefing of what changed and what it means for your deals",
  "Log won and lost deals and customer feedback by just telling your assistant",
  "It tells you what to share next to make answers sharper",
  "Unlimited teammates on one account",
  "Sign in once, disconnect any time",
] as const;

// Example prompts for the marketing page. Each maps to something the tools
// really do, so nothing here promises a capability that isn't built.
export const CONNECT_EXAMPLES = [
  "What changed with my competitors this week, and what should I worry about?",
  "Should we respond to Acme's new pricing?",
  "We just lost a deal to Acme on price. Log it.",
  "Which competitor is heating up fastest right now?",
] as const;
