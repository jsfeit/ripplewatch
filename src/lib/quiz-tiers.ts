import { Eye, Radar, Target, Rocket, type LucideIcon } from "lucide-react";

// Plain data, deliberately kept out of the "use client" quiz component: a
// server component (the quiz page) needs to render these tier descriptions
// in static HTML for crawlers, and re-exporting data through a client
// component's module boundary breaks at build time (Next.js treats every
// export of a "use client" file as a client reference, not a plain value).
export type Tier = {
  name: string;
  icon: LucideIcon;
  range: [number, number];
  summary: string;
  // A short checklist (2-3 items), not one thin sentence — this is what's
  // behind the email gate, so it needs to actually feel worth the ask. The
  // last item in every tier's list ties the gap directly to Ripplewatch
  // rather than staying generic advice a search engine could've given.
  nextSteps: string[];
};

export const TIERS: Tier[] = [
  {
    name: "Reactive",
    icon: Eye,
    range: [0, 4],
    summary: "You're finding out about competitor moves after they've already mattered, usually from a customer or a lost deal.",
    nextSteps: [
      "Pick 3-5 real competitors, the ones that actually come up in deals, not everyone in your category.",
      "Get notified the moment their pricing, hiring, or product pages change; that alone closes most of the gap.",
      "Ripplewatch does exactly this out of the box: pricing, hiring, and product tracking, scored and delivered to Slack or email, with no dashboard to remember to check.",
    ],
  },
  {
    name: "Aware",
    icon: Radar,
    range: [5, 8],
    summary: "You've got some monitoring in place, but it's mostly noise: alerts with no read on which ones are actually worth acting on.",
    nextSteps: [
      "Write down your last 5-10 lost deals and churned customers, and why, even roughly.",
      "Tie new signals to that list, so a pricing change that's dangerous for you reads differently than one that isn't.",
      "Ripplewatch scores every signal against your own lost-deal and churn reasons automatically, so this stops being a manual cross-reference you have to remember to do.",
    ],
  },
  {
    name: "Systematic",
    icon: Target,
    range: [9, 12],
    summary: "You've built a real process, but it's still generic: the same priority framework applied to every signal, regardless of your specific business.",
    nextSteps: [
      "Swap a general severity scale for relevance scored against your actual positioning and ICP, not a one-size-fits-all rubric.",
      "Make sure whoever owns this isn't the single point of failure if they're out sick or leave.",
      "This is Ripplewatch's whole reason for existing: every signal scored against your specific positioning and win/loss history, not a generic tier list, and it doesn't live in one person's head.",
    ],
  },
  {
    name: "Predictive",
    icon: Rocket,
    range: [13, 15],
    summary: "You're already doing most of what separates teams that catch competitive threats early: scored, fast, and tied to real outcomes.",
    nextSteps: [
      "The real risk now is scale: does this hold up when you add a 6th competitor, or when three more people need visibility into it?",
      "Manual systems like this tend to crack quietly, someone's on vacation, a spreadsheet gets stale, and nobody notices until a deal is already lost.",
      "Ripplewatch is what this looks like running itself: the same discipline you've already built, minus the person-hours, and it won't quietly stop working the week you're heads-down on something else.",
    ],
  },
];

export function tierForScore(score: number): Tier {
  return TIERS.find((t) => score >= t.range[0] && score <= t.range[1]) ?? TIERS[0];
}
