// What is missing from the picture, said once for the whole account, with the ways to fill each piece in.
//
// A competitor-by-competitor "not reading pricing" repeated four times is noise. This groups the gaps by what is missing
// (outcomes, pricing, reviews, hiring, plans), names who it affects, and gives the person up to three ways forward:
//   tell      - say it in the chat and Ripplewatch saves it
//   connected - have the assistant look in whatever else is connected to this chat (CRM, billing, support, browser)
//   settings  - fix the link Ripplewatch reads from
// Pure and the same for every account, so the wording is testable. The prompts are written for the assistant to act on:
// they ask it to say what it will read before reading, and to save only what the person approves.
import type { CoverageSource } from "@/lib/source-coverage";

export type GapRoute = { kind: "tell" | "connected" | "settings"; label: string; prompt: string | null };
export type Gap = { id: string; title: string; why: string; affects: string[]; routes: GapRoute[] };

export type GapInput = {
  sellsTo: "business" | "consumer" | "both" | null;
  outcomesLogged: number;
  contextNotes: number;
  competitors: { name: string; looksWrong: boolean; coverage: CoverageSource[] }[];
};

const OUTCOMES_ENOUGH = 5;
const MAX_NAMES = 6;

const names = (list: string[]) => (list.length > MAX_NAMES ? `${list.slice(0, MAX_NAMES).join(", ")} and ${list.length - MAX_NAMES} more` : list.join(", "));
const missingFor = (input: GapInput, sourceId: string) =>
  input.competitors.filter((c) => !c.looksWrong && c.coverage.some((s) => s.id === sourceId && !s.working)).map((c) => c.name);

export function buildGaps(input: GapInput): Gap[] {
  const gaps: Gap[] = [];
  const consumer = input.sellsTo === "consumer";

  if (input.outcomesLogged < OUTCOMES_ENOUGH) {
    gaps.push({
      id: "outcomes",
      title: consumer ? "Why customers leave" : "Which competitors cost you deals",
      why: consumer
        ? "Without churn and cancellation reasons, Ripplewatch can say what competitors are doing but not which ones are costing you customers."
        : "Without logged wins and losses, Ripplewatch can say what competitors are doing but not which ones cost you money. One deal is enough to start.",
      affects: [],
      routes: [
        { kind: "tell", label: consumer ? "Tell me about churn" : "Log a deal", prompt: consumer ? "Using Ripplewatch: log my customer churn. " : "Using Ripplewatch: log a deal. " },
        {
          kind: "connected",
          label: "Look in my connected tools",
          prompt: consumer
            ? "Using Ripplewatch: check the other tools connected in this chat (billing, support inbox, surveys) for cancellations and the reasons given, especially any that name a competitor. Tell me what you plan to read first, and save only what I approve."
            : "Using Ripplewatch: check the other tools connected in this chat (CRM, call recorder, support inbox) for closed-won and closed-lost deals and competitor mentions. Tell me what you plan to read first, and save only what I approve.",
        },
      ],
    });
  }

  for (const [id, label, source] of [
    ["pricing", "Pricing pages Ripplewatch can't read", "pricing"],
    ["reviews", "Review pages Ripplewatch isn't reading", "reviews"],
    ["hiring", "Job boards Ripplewatch can't read", "hiring"],
  ] as const) {
    const who = missingFor(input, source);
    if (who.length === 0) continue;
    const routes: GapRoute[] = [];
    if (source !== "hiring") {
      routes.push({
        kind: "tell",
        label: source === "pricing" ? "I'll give you the prices" : "I'll give you the ratings",
        prompt: `Using Ripplewatch: I'll tell you the current ${source === "pricing" ? "entry prices" : "review ratings"} for ${names(who)}. Ask me for each, then save them with add_context_note. `,
      });
      routes.push({
        kind: "connected",
        label: "Look in my connected tools",
        prompt: `Using Ripplewatch: if a browser or web tool is connected in this chat, open the ${source === "pricing" ? "pricing pages" : "review pages"} for ${names(who)} and tell me what ${source === "pricing" ? "entry prices" : "ratings"} you find. Save them with add_context_note only after I confirm.`,
      });
    }
    routes.push({ kind: "settings", label: "Fix the link in Settings → Competitors", prompt: null });
    gaps.push({
      id,
      title: label,
      why:
        source === "pricing"
          ? "Price moves are one of the strongest strength and weakness signals, and the page may hide prices or block automated reads."
          : source === "reviews"
            ? "Review velocity and complaint themes show where a competitor is weak."
            : "Hiring mix shows where a competitor is investing.",
      affects: who,
      routes,
    });
  }

  if (input.contextNotes === 0) {
    gaps.push({
      id: "plans",
      title: "What you're building next",
      why: "Competitor moves are judged against your own plans. One line about the next few months is enough.",
      affects: [],
      routes: [{ kind: "tell", label: "Tell me my plans", prompt: "Using Ripplewatch: here is what we're building or changing in the next few months: " }],
    });
  }
  return gaps;
}
