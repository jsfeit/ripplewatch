import { ATTACH_PROMPT } from "@/lib/customer-metrics";
import type { Audience } from "@/lib/sales-motion";

// What to suggest asking first. One place, so the connect step, the finish screen, the Settings first-look
// card, the onboarding emails and the assistant's own start_here all say the same thing, and all of it is
// written for this company: its name, the competitors it named, and whether it sells to businesses,
// consumers or both. A B2B team is asked about deals; a consumer company is asked about churn and ratings.
// Pure, so the server and the browser can both use it.
export type PromptContext = {
  company: string | null;
  sellsTo: Audience | null;
  competitors: string[];
};

export type FirstPrompt = { id: string; label: string; blurb: string; prompt: string };

// Asked of the person's own assistant: read the deals (an attached export, or their CRM) and hand them to
// import_win_loss. Batches stay under what one call accepts (about 600 rows), rows go through verbatim so
// Ripplewatch can map any column layout itself, and the assistant reports what actually came in.
export const DEALS_PROMPT =
  "Using Ripplewatch: import my deal history. If I've attached a CSV or spreadsheet, read that. Otherwise pull my closed-won and closed-lost deals from my CRM, and ask me before you read anything. Send the rows to Ripplewatch with import_win_loss exactly as they appear, header row first, close dates included, in batches of about 500 rows, going back as far as the data goes. Then tell me how many deals came in.";

const USING = "Using Ripplewatch: ";

function clean(names: string[]): string[] {
  return names.map((n) => n.trim()).filter(Boolean);
}

// "A", "A and B", "A, B and C".
export function nameList(names: string[], max = 3): string {
  const shown = clean(names).slice(0, max);
  if (shown.length <= 1) return shown[0] ?? "";
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}

function who(ctx: PromptContext): { us: string; c: string | null; d: string | null; list: string } {
  const names = clean(ctx.competitors);
  return { us: ctx.company?.trim() || "us", c: names[0] ?? null, d: names[1] ?? null, list: nameList(names) };
}

const side = (ctx: PromptContext): "business" | "consumer" | "both" => (ctx.sellsTo === "consumer" ? "consumer" : ctx.sellsTo === "both" ? "both" : "business");

function heating(ctx: PromptContext): FirstPrompt {
  const { us, c, d } = who(ctx);
  const s = side(ctx);
  let prompt: string;
  if (!c) prompt = `${USING}which competitor is heating up fastest?`;
  else if (s === "consumer") prompt = `${USING}is ${c} heating up or cooling off, and could it be pulling customers from ${us}?`;
  else if (s === "both") prompt = `${USING}is ${c} heating up or cooling off, and is it showing up in our deals or our churn?`;
  else prompt = d ? `${USING}which is heating up faster, ${c} or ${d}, and what changed?` : `${USING}is ${c} heating up or cooling off, and what changed?`;
  return {
    id: "heating",
    label: "Who's heating up",
    blurb: "A Momentum score, Heating up, Steady or Cooling, with the signals pulling it that way.",
    prompt,
  };
}

function briefing(ctx: PromptContext): FirstPrompt {
  const { c } = who(ctx);
  return {
    id: "briefing",
    label: "Weekly briefing",
    blurb: c ? `What changed across your competitors, starting with ${c}, and what to do about it.` : "What changed across your competitors and what to do about it.",
    prompt: `${USING}give me my competitive briefing for this week.`,
  };
}

function costingDeals(ctx: PromptContext): FirstPrompt {
  const { us } = who(ctx);
  return {
    id: "deals",
    label: "What's costing us deals",
    blurb: "Ranked reasons you lose, checked against the deals you have told it about.",
    prompt: `${USING}which competitor is costing ${us} the most deals, and what should we do about it?`,
  };
}

function churn(ctx: PromptContext): FirstPrompt {
  const { us } = who(ctx);
  return {
    id: "churn",
    label: "Is churn a problem?",
    blurb: "Reads your churn and lines it up against competitor moves. It needs a few months of numbers, and will ask for them if you haven't added any.",
    prompt: `${USING}is churn a problem for ${us}, and did a competitor move around when it changed?`,
  };
}

function logDeal(ctx: PromptContext): FirstPrompt {
  const { c } = who(ctx);
  return {
    id: "log",
    label: "Log a deal",
    blurb: "Tell it how a deal went in plain words. It records it against the right competitor.",
    prompt: `${USING}log a deal for me. I'll tell you how it went: whether we won or lost${c ? `, against ${c} or someone else,` : ""} and why. Ask me for anything that's missing.`,
  };
}

function logChurn(): FirstPrompt {
  return {
    id: "logchurn",
    label: "Log my churn",
    blurb: "Attach an export or let it read your billing tool. It counts the rows and shows you the table first.",
    prompt: ATTACH_PROMPT,
  };
}

function survey(ctx: PromptContext): FirstPrompt {
  const { list } = who(ctx);
  const company = ctx.company?.trim();
  return {
    id: "survey",
    label: "Why people leave",
    blurb: "A short survey for you to place. Your numbers show when churn moved. Only customers can say why.",
    prompt: `${USING}draft a cancellation survey${company ? ` for ${company}` : ""} that asks whether people also use ${list || "our competitors"}, and offers "I use both" and "I'm not switching". Tell me where to put it, and I'll place it myself.`,
  };
}

function logAny(): FirstPrompt {
  return {
    id: "log",
    label: "Log a deal or churn",
    blurb: "Say it in plain words. It records it on the right side.",
    prompt: `${USING}I'll tell you about a deal we won or lost, or about customers who left. Ask me which it is, and for anything that's missing.`,
  };
}

// The tabs on the connect step, shown the moment the assistant connects: what to try first, written for
// this company. Five of them whatever the audience, so the row keeps the same shape.
export function firstPrompts(ctx: PromptContext): FirstPrompt[] {
  const s = side(ctx);
  if (s === "consumer") return [heating(ctx), churn(ctx), briefing(ctx), logChurn(), survey(ctx)];
  if (s === "both") return [heating(ctx), costingDeals(ctx), churn(ctx), briefing(ctx), logAny()];
  return [
    heating(ctx),
    briefing(ctx),
    costingDeals(ctx),
    logDeal(ctx),
    {
      id: "import",
      label: "Import deals",
      blurb: "Attach a CSV or let it read your CRM. Any column layout works.",
      prompt: DEALS_PROMPT,
    },
  ];
}

// The "ask your first question" list on the finish screen.
export function firstQuestions(ctx: PromptContext): string[] {
  const { us, c } = who(ctx);
  const s = side(ctx);
  const startHere = `${USING}start here. What do you know about ${us} so far, and what would make your answers sharper?`;
  const lead = heating(ctx).prompt;
  if (!c) {
    return [
      `${USING}what changed with my competitors this week?`,
      `${USING}which competitor is heating up fastest?`,
      ...(s === "business" ? [] : [churn(ctx).prompt]),
      startHere,
    ];
  }
  if (s === "consumer") {
    return [lead, churn(ctx).prompt, `${USING}how are customers rating ${c} lately, in app stores and reviews, and is it moving?`, startHere];
  }
  if (s === "both") {
    return [lead, costingDeals(ctx).prompt, churn(ctx).prompt, startHere];
  }
  return [lead, `${USING}what's changed with ${c} this week, and should I worry?`, `${USING}should we respond to ${c}'s pricing?`, startHere];
}

// What the assistant's own start_here hands back, and what the Settings card and onboarding emails show.
// Plain questions, without the "Using Ripplewatch:" the assistant gets. Deterministic on purpose: it has to
// be instant and identical between the assistant and the web app.
export function starterPrompts(ctx: PromptContext, has: { deals: boolean; churn: boolean }): string[] {
  const { us, c, d } = who(ctx);
  const s = side(ctx);
  if (!c) {
    return [
      s === "consumer" ? "Start tracking the competitor customers leave us for most." : "Start tracking the competitor we lose deals to most.",
      "What can you tell me about my competitors?",
    ];
  }
  const compare = d ? `How does ${c}'s pricing compare to ${d}'s?` : s === "consumer" ? `How are customers rating ${c} lately, and is it moving?` : `Should we be worried about ${c}'s latest move?`;
  if (s === "consumer") {
    return [
      `What changed at ${c} in the last two weeks, and does it matter to ${us}?`,
      "Is churn a problem for us, and did a competitor move around when it changed?",
      compare,
      "Draft a short cancellation survey that asks whether people also use our competitors.",
      ...(has.churn ? [] : ["I want to add my churn numbers."]),
    ];
  }
  if (s === "both") {
    return [
      `What changed at ${c} in the last two weeks, and does it matter to ${us}?`,
      "Which of my competitors is heating up the most right now?",
      "Is churn a problem for us, and did a competitor move around when it changed?",
      compare,
      ...(has.deals || has.churn ? [] : [`I want to log a recent deal or customers I lost to ${c}.`]),
    ];
  }
  return [
    `What changed at ${c} in the last two weeks, and does it matter to us?`,
    "Which of my competitors is heating up the most right now?",
    compare,
    `Write a short battlecard I can use when a prospect brings up ${c}.`,
    ...(has.deals ? [] : [`I want to log a recent deal I won or lost against ${c}.`]),
  ];
}
