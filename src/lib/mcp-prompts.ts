import { ATTACH_PROMPT } from "@/lib/customer-metrics";
import { DEALS_PROMPT } from "@/lib/first-prompts";

// The ready-made prompts Ripplewatch offers inside an assistant's own prompt menu (MCP prompts). A server can't own
// a conversation, but these give Ripplewatch a clear place to start in any chat: the assistant lists them under
// "Ripplewatch", the person picks one, and the text below is put in the chat. Each starts "Using Ripplewatch:",
// which is what makes the assistant reach for the connected tools instead of answering from memory.
//
// Pure, so the list and its wording can be tested. Titles all start "Ripplewatch:" so they group together.
export type McpPromptArg = { name: string; description: string };
export type McpPromptDef = {
  name: string;
  title: string;
  description: string;
  args?: McpPromptArg[];
  text: (args: Record<string, string | undefined>) => string;
};

const USING = "Using Ripplewatch: ";
// An argument left blank reads naturally instead of leaving a gap.
const or = (v: string | undefined, fallback: string) => (v && v.trim() ? v.trim() : fallback);

export const MCP_PROMPTS: McpPromptDef[] = [
  {
    name: "get-started",
    title: "Ripplewatch: Get started",
    description: "A guided first run: what's been found on your competitors and what to try first.",
    text: () => "I'm new to Ripplewatch. Use start_here and walk me through getting set up, one step at a time.",
  },
  {
    name: "weekly-briefing",
    title: "Ripplewatch: Weekly briefing",
    description: "What changed across your competitors this week, and what to do about it.",
    text: () => `${USING}give me my competitive briefing for this week, and tell me what to do about it.`,
  },
  {
    name: "whos-heating-up",
    title: "Ripplewatch: Who's heating up",
    description: "Each competitor's Momentum: heating up, steady or cooling, and the signals behind it.",
    text: () => `${USING}which of my competitors is heating up fastest right now, and what changed?`,
  },
  {
    name: "what-changed",
    title: "Ripplewatch: What changed at a competitor",
    description: "The last two weeks at one competitor, and whether it matters to you.",
    args: [{ name: "competitor", description: "The competitor's name, for example Klue" }],
    text: (a) => `${USING}what has ${or(a.competitor, "my top competitor")} changed in the last two weeks, and does it matter to us?`,
  },
  {
    name: "compare-pricing",
    title: "Ripplewatch: Compare two competitors' pricing",
    description: "How two competitors price today, and where you stand.",
    args: [
      { name: "first", description: "The first competitor" },
      { name: "second", description: "The second competitor" },
    ],
    text: (a) => `${USING}how does ${or(a.first, "my top competitor")}'s pricing compare to ${or(a.second, "my next competitor")}'s, and where do we stand?`,
  },
  {
    name: "costing-us-deals",
    title: "Ripplewatch: What's costing us deals",
    description: "The competitors you lose to most, checked against the deals you've told Ripplewatch about.",
    text: () => `${USING}which competitor is costing us the most deals, and what should we do about it?`,
  },
  {
    name: "is-churn-a-problem",
    title: "Ripplewatch: Is churn a problem?",
    description: "Reads your churn and lines it up against competitor moves. Needs a few months of numbers.",
    text: () => `${USING}is churn a problem for us, and did a competitor move around when it changed?`,
  },
  {
    name: "add-churn",
    title: "Ripplewatch: Add my churn numbers",
    description: "Attach an export or let your assistant read your billing tool. It shows the table before saving.",
    text: () => ATTACH_PROMPT,
  },
  {
    name: "log-a-deal",
    title: "Ripplewatch: Log a deal I won or lost",
    description: "Tell it how a deal went in plain words. It records it against the right competitor.",
    text: () =>
      `${USING}log a deal for me. I'll tell you how it went: whether we won or lost, against which competitor, and why. Ask me for anything that's missing.`,
  },
  {
    name: "import-my-deals",
    title: "Ripplewatch: Import my deals",
    description: "Pull closed-won and closed-lost deals from a connected CRM or an attached file.",
    text: () => DEALS_PROMPT,
  },
  {
    name: "cancellation-survey",
    title: "Ripplewatch: Draft a cancellation survey",
    description: "A short survey that asks whether people also use your competitors. You place it.",
    text: () =>
      `${USING}draft a short cancellation survey that asks whether people also use our competitors, and offers "I use both" and "I'm not switching". Tell me where to put it, and I'll place it myself.`,
  },
  {
    name: "how-to-use",
    title: "Ripplewatch: How to get the most out of it",
    description: "Explains win/loss data, Momentum, the emails you'll get, and what to ask.",
    text: () =>
      "Use how_to_use to explain how I get the most out of Ripplewatch: how to get my win/loss data in, what momentum means, what I'll receive daily, weekly and monthly, how to see recent changes, and what to ask. Start with the overview and ask what I want to go deeper on.",
  },
];
