// The "how to get the most out of Ripplewatch" guide, written once. The
// assistant's how_to_use tool, the /connect/guide page and the setup checklist
// all read this, so what a customer hears in chat matches what's on the page.
// Facts here must match the product: the win/loss threshold is
// MIN_REASONS_FOR_TRENDS in next-best-action.ts, the notification list is
// CONNECT_NOTIFICATIONS in connect.ts, and the competitor check runs daily.
import { CONNECT_NOTIFICATIONS } from "@/lib/connect";

export type GuideTopicId = "overview" | "win_loss" | "momentum" | "recent_events" | "notifications" | "prompts" | "team";

export type GuideTopic = {
  id: GuideTopicId;
  title: string;
  // One line, used in the topic index.
  summary: string;
  paragraphs: string[];
  // Things to say to the assistant, shown as copyable examples.
  prompts?: string[];
};

export const GUIDE_TOPICS: GuideTopic[] = [
  {
    id: "overview",
    title: "How it works",
    summary: "What Ripplewatch does and how it gets sharper.",
    paragraphs: [
      "Ripplewatch checks your competitors once a day for pricing changes, hiring, press, funding and product moves. It scores every change against how you position yourself, who you sell to, and the deals you've won and lost, so the same pricing change can be urgent for one company and noise for another.",
      "You ask in your assistant, or you read the weekly email. There's nothing to log into. The more it knows about your deals, the more specific its answers get, so the single best thing you can do after adding competitors is tell it how a few deals went.",
    ],
    prompts: ["What can Ripplewatch do for me, and what should I do first?"],
  },
  {
    id: "win_loss",
    title: "Getting your win/loss data in",
    summary: "Five ways to add the deals you won and lost.",
    paragraphs: [
      "Win/loss is what turns competitor news into answers about your business. It lets Ripplewatch say which moves actually cost you deals, and it feeds each competitor's momentum. Even one deal helps. Patterns across your deals start to show once you've logged about five reasons, and a competitor's win/loss trend counts toward its momentum after about four.",
      "What to log: the competitor, whether you won or lost, and the reason in the customer's own words. Don't tidy it up. Say it the way the customer said it.",
      "Five ways in, from easiest: (1) Tell your assistant in plain English. (2) Use the form under Settings, then Data. (3) Upload a CSV from your CRM under Settings, then Data. (4) Forward or paste a list of deals to the email address shown under Settings, then Data, and Ripplewatch pulls out the reasons. (5) If your assistant can also reach your CRM, call recorder or support inbox, ask it to read recent closed-lost deals or competitor mentions from there. It will tell you what it's about to read before it reads it.",
    ],
    prompts: [
      "We lost a deal to Notion last week because they were cheaper for a team our size. Log it.",
      "Pull my closed-won and closed-lost deals from the last 90 days from my CRM, with the reason for each, and add them to Ripplewatch.",
      "In my call recorder, find calls from the last 30 days where Linear came up, and log those mentions in Ripplewatch.",
    ],
  },
  {
    id: "momentum",
    title: "What momentum means",
    summary: "The label on each competitor and what's behind it.",
    paragraphs: [
      "Momentum is Ripplewatch's read on whether a competitor is becoming more of a threat to you. Each competitor gets one of five labels: Heating up, Steady, Cooling, Gone quiet, or Not enough history yet.",
      "It's built from the last 30 days of hiring, pricing, press and product activity, how relevant those changes are to your business, the win/loss trend on deals against them, and competitor mentions you've logged from sales calls. A label with little data behind it is marked low confidence, so a thin read doesn't look as certain as a full one.",
      "Heating up means more is happening and more of it matters to you. Cooling means less of both. Gone quiet means little visible activity, which isn't always good news: a competitor that goes dark is sometimes heads down on a launch, a repricing or a repositioning. You also get your own momentum, from your win-rate and customer-feedback trends.",
    ],
    prompts: ["Which competitor is heating up fastest, and why?", "Why is Asana cooling? What's driving that label?"],
  },
  {
    id: "recent_events",
    title: "Seeing what changed recently",
    summary: "There's no feed to open. Ask.",
    paragraphs: [
      "Ripplewatch has no dashboard or feed to check. Recent changes are one question away, in your assistant, and you can scope them any way you like: one competitor, one time window, only the ones that matter.",
      "Competitors are checked once a day, so a change usually shows up within a day of it happening. A briefing gives you the week's verdict and the highest-relevance recent changes. Asking about one competitor adds its momentum, the drivers behind it, and its recent signals.",
    ],
    prompts: [
      "What changed with my competitors this week, and what should I worry about?",
      "What has Notion changed in the last two weeks?",
      "Show me only the changes that were High relevance to us this month.",
    ],
  },
  {
    id: "notifications",
    title: "What you'll receive",
    summary: "Every email and Slack message, and how to turn each off.",
    paragraphs: [
      "You can always ask your assistant for the latest. These are the messages that come to you without asking.",
      ...CONNECT_NOTIFICATIONS.map((n) => `${n.name}: ${n.when} ${n.control}`),
      "Slack is where a team sees all of this, so connect it if more than one person uses Ripplewatch. Email goes only to the account owner: it's the fallback when Slack isn't connected, or an extra you can switch on.",
    ],
  },
  {
    id: "prompts",
    title: "What to ask, by job",
    summary: "Prompts for the five things people use it for.",
    paragraphs: [
      "Name the competitor and the situation. The more specific you are, the more specific the answer.",
      "Update on one competitor: ask for the read on a single company, with what changed and whether it matters to you.",
      "Prep for a call: ask what a prospect is likely to bring up about a competitor, and where you win and lose against them.",
      "Respond to a move: ask whether a specific change deserves a reaction, and what the options are.",
      "Exec or board update: ask for a short, shareable summary of the competitive picture.",
      "Lost-deal patterns: ask what's actually costing you deals. This one gets better the more deals you've logged.",
    ],
    prompts: [
      "Give me the read on Linear: what they've changed lately and whether it matters to us.",
      "I have a call with a prospect who's also looking at Notion. What are they likely to raise, and where do we win and lose?",
      "Asana just changed its pricing. Should we respond, and what are our options?",
      "Write me three sentences on the competitive picture this month for our board update.",
      "What's costing us deals right now? Use everything we've logged.",
    ],
  },
  {
    id: "team",
    title: "Using it alone or with a team",
    summary: "Solo setup, and what's different with teammates.",
    paragraphs: [
      "Solo: connect your assistant, add your competitors, tell it how a few deals went, and ask when you need it. The weekly email keeps you current in between.",
      "With a team: invite teammates under Settings. Everyone shares the same competitors and deal history, and each person connects their own assistant. Email goes only to the account owner, so connect Slack: alerts, the weekly digest and the monthly recap then post to a channel everyone can see. Anyone can log a deal, so agree on who does, and say reasons the way the customer said them.",
    ],
    prompts: ["Which of our competitors should the whole team be watching, and who owns each?"],
  },
];

export function getGuideTopic(id: string): GuideTopic | undefined {
  return GUIDE_TOPICS.find((t) => t.id === id);
}

// Plain-text rendering for the assistant, so it can read a topic back in its
// own words without markup getting in the way.
export function guideTopicText(topic: GuideTopic): string {
  const prompts = topic.prompts?.length ? `\n\nThings the user can say:\n${topic.prompts.map((p) => `- ${p}`).join("\n")}` : "";
  return `${topic.title}\n\n${topic.paragraphs.join("\n\n")}${prompts}`;
}
