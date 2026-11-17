import { ATTACH_PROMPT } from "@/lib/customer-metrics";
import type { Audience } from "@/lib/sales-motion";

// What to suggest asking first. One place, so the connect step, the finish screen, the Settings first-look
// card, the onboarding emails and the assistant's own start_here all say the same thing, and all of it is
// written for this company: its name, the competitors it named, whether it sells to businesses, consumers or
// both, and what data it has given so far.
//
// The rule: never suggest a question that can't be answered yet. Right after connecting there are no deals
// and no churn numbers, so "what's costing us deals" or "is churn a problem" can only come back as "I don't
// have your numbers." Until that data exists those appear as a step to add it, and once it exists they turn
// into the real question. What works from the first minute is who's heating up, a briefing, what a competitor
// charges, and (for consumer companies) drafting a cancellation survey.
//
// Pure, so the server and the browser can both use it.
export type PromptContext = {
  company: string | null;
  sellsTo: Audience | null;
  competitors: string[];
  // What the account has given so far. Left out means nothing yet, which is the case on the connect step.
  has?: { deals: boolean; churn: boolean };
};

export type FirstPrompt = { id: string; label: string; blurb: string; prompt: string };

// Asked of the person's own assistant: read the deals (an attached export, or their CRM) and hand them to
// import_win_loss. Batches stay under what one call accepts (about 600 rows), rows go through verbatim so
// Ripplewatch can map any column layout itself, and the assistant reports what actually came in.
export const DEALS_PROMPT =
  "Using Ripplewatch: import my deal history. If I've attached a CSV or spreadsheet, read that. Otherwise pull my closed-won and closed-lost deals from my CRM, and ask me before you read anything. Send the rows to Ripplewatch with import_win_loss exactly as they appear, header row first, close dates included, in batches of about 500 rows, going back as far as the data goes. Then tell me how many deals came in.";

const USING = "Using Ripplewatch: ";

// What actually gets copied or sent to an assistant. A plain question ("What changed at Acme?") is read by
// Claude or ChatGPT as a general question and answered from the web; starting with "Using Ripplewatch:" is
// what makes it reach for the connected tools. Prompts that already start that way are left alone.
export function forAssistant(text: string): string {
  const t = text.trim();
  return /^using ripplewatch\b/i.test(t) ? t : `${USING}${t}`;
}

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
const has = (ctx: PromptContext) => ctx.has ?? { deals: false, churn: false };

// ---- Works from the first minute: it only needs the competitors, which are being checked now.

function heating(ctx: PromptContext): FirstPrompt {
  const { us, c, d } = who(ctx);
  const s = side(ctx);
  let prompt: string;
  if (!c) prompt = `${USING}which competitor is heating up fastest?`;
  else if (s === "consumer") prompt = `${USING}is ${c} heating up or cooling off, and could it be pulling customers from ${us}?`;
  // Only asks about our own deals and churn once there is something to compare against.
  else if (s === "both" && (has(ctx).deals || has(ctx).churn)) prompt = `${USING}is ${c} heating up or cooling off, and is it showing up in our deals or our churn?`;
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

function pricing(ctx: PromptContext): FirstPrompt {
  const { c, d } = who(ctx);
  return {
    id: "pricing",
    label: d ? "Compare pricing" : "Their pricing",
    blurb: "What they charge and how it's packaged, read from their pricing page.",
    prompt: !c
      ? `${USING}what do my competitors charge, and how is it packaged?`
      : d
        ? `${USING}how does ${c}'s pricing compare to ${d}'s?`
        : `${USING}what does ${c} charge, and how is it packaged?`,
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

// ---- Teaching it: adds data, which is what makes the next two kinds of question answerable.

function logDeal(ctx: PromptContext): FirstPrompt {
  const { c } = who(ctx);
  return {
    id: "log",
    label: "Log a deal",
    blurb: "Tell it how a deal went in plain words. It records it against the right competitor.",
    prompt: `${USING}log a deal for me. I'll tell you how it went: whether we won or lost${c ? `, against ${c} or someone else,` : ""} and why. Ask me for anything that's missing.`,
  };
}

function importDeals(): FirstPrompt {
  return {
    id: "import",
    label: "Import deals",
    blurb: "Attach a CSV or let it read your CRM. Any column layout works. Once they're in, you can ask what's costing you deals.",
    prompt: DEALS_PROMPT,
  };
}

function addChurn(): FirstPrompt {
  return {
    id: "addchurn",
    label: "Add my churn",
    blurb: "Attach an export or let it read your billing tool. It counts the rows and shows you the table first. Once it's in, you can ask whether churn is a problem.",
    prompt: ATTACH_PROMPT,
  };
}

function logAny(): FirstPrompt {
  return {
    id: "log",
    label: "Log a deal or churn",
    blurb: "Say it in plain words. It records it on the right side, and once there's enough you can ask what's costing you.",
    prompt: `${USING}I'll tell you about a deal we won or lost, or about customers who left. Ask me which it is, and for anything that's missing.`,
  };
}

// ---- Only once the data exists.

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
    blurb: "Reads your churn and lines it up against competitor moves.",
    prompt: `${USING}is churn a problem for ${us}, and did a competitor move around when it changed?`,
  };
}

// The tabs on the connect step, shown the moment the assistant connects: what to try first, written for
// this company. Five of them whatever the audience, so the row keeps the same shape.
export function firstPrompts(ctx: PromptContext): FirstPrompt[] {
  const s = side(ctx);
  const h = has(ctx);
  if (s === "consumer") {
    return [heating(ctx), h.churn ? churn(ctx) : pricing(ctx), briefing(ctx), h.churn ? pricing(ctx) : addChurn(), survey(ctx)];
  }
  if (s === "both") {
    return [heating(ctx), briefing(ctx), h.deals ? costingDeals(ctx) : pricing(ctx), h.churn ? churn(ctx) : survey(ctx), logAny()];
  }
  return [heating(ctx), briefing(ctx), h.deals ? costingDeals(ctx) : pricing(ctx), logDeal(ctx), importDeals()];
}

// The "ask your first question" list on the finish screen. Same rule: only questions that can be answered now.
export function firstQuestions(ctx: PromptContext): string[] {
  const { us, c } = who(ctx);
  const s = side(ctx);
  const h = has(ctx);
  const startHere = `${USING}start here. What do you know about ${us} so far, and what would make your answers sharper?`;
  const lead = heating(ctx).prompt;
  if (!c) {
    return [`${USING}what changed with my competitors this week?`, `${USING}which competitor is heating up fastest?`, startHere];
  }
  const changed = `${USING}what's changed with ${c} this week, and should I worry?`;
  if (s === "consumer") {
    return [lead, changed, h.churn ? churn(ctx).prompt : `${USING}how are customers rating ${c} lately, in app stores and reviews, and is it moving?`, startHere];
  }
  if (s === "both") {
    return [lead, changed, h.deals ? costingDeals(ctx).prompt : h.churn ? churn(ctx).prompt : pricing(ctx).prompt, startHere];
  }
  return [lead, changed, `${USING}should we respond to ${c}'s pricing?`, startHere];
}

// What the assistant's own start_here hands back, and what the Settings card and onboarding emails show.
// Plain questions, without the "Using Ripplewatch:" the assistant gets. Deterministic on purpose: it has to
// be instant and identical between the assistant and the web app. Here the data is known, so a question that
// needs deals or churn is only included once they exist, and a step to add them is included until then.
export function starterPrompts(ctx: PromptContext, data: { deals: boolean; churn: boolean }): string[] {
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
      compare,
      "Draft a short cancellation survey that asks whether people also use our competitors.",
      data.churn ? "Is churn a problem for us, and did a competitor move around when it changed?" : "I want to add my churn numbers.",
    ];
  }
  if (s === "both") {
    return [
      `What changed at ${c} in the last two weeks, and does it matter to ${us}?`,
      "Which of my competitors is heating up the most right now?",
      compare,
      ...(data.churn ? ["Is churn a problem for us, and did a competitor move around when it changed?"] : []),
      ...(data.deals ? [] : [`I want to log a recent deal or customers I lost to ${c}.`]),
    ];
  }
  return [
    `What changed at ${c} in the last two weeks, and does it matter to us?`,
    "Which of my competitors is heating up the most right now?",
    compare,
    `Write a short battlecard I can use when a prospect brings up ${c}.`,
    ...(data.deals ? [] : [`I want to log a recent deal I won or lost against ${c}.`]),
  ];
}
