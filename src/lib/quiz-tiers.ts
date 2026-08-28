import { Eye, Radar, Target, Rocket, type LucideIcon } from "lucide-react";

// Plain data, deliberately kept out of the "use client" quiz component: a
// server component (the quiz page) needs to render these tier descriptions
// in static HTML for crawlers, and re-exporting data through a client
// component's module boundary breaks at build time (Next.js treats every
// export of a "use client" file as a client reference, not a plain value).
export type Tier = { name: string; icon: LucideIcon; range: [number, number]; summary: string; nextStep: string };

export const TIERS: Tier[] = [
  {
    name: "Reactive",
    icon: Eye,
    range: [0, 4],
    summary: "You're finding out about competitor moves after they've already mattered, usually from a customer or a lost deal.",
    nextStep:
      "The fastest fix isn't a full program: pick 3-5 real competitors and get notified the moment their pricing, hiring, or product pages change. That alone closes most of the gap.",
  },
  {
    name: "Aware",
    icon: Radar,
    range: [5, 8],
    summary: "You've got some monitoring in place, but it's mostly noise: alerts with no read on which ones are actually worth acting on.",
    nextStep:
      "The next step is tying incoming signals to your own lost-deal and churn reasons, so a pricing change that's dangerous for you gets flagged differently than one that isn't.",
  },
  {
    name: "Systematic",
    icon: Target,
    range: [9, 12],
    summary: "You've built a real process, but it's still generic: the same priority framework applied to every signal, regardless of your specific business.",
    nextStep:
      "The gap between Systematic and Predictive is relevance scoring tied to your actual positioning and win/loss history, not a general severity scale everyone else uses too.",
  },
  {
    name: "Predictive",
    icon: Rocket,
    range: [13, 15],
    summary: "You're already doing most of what separates teams that catch competitive threats early: scored, fast, and tied to real outcomes.",
    nextStep:
      "Worth checking whether it holds up as you add more competitors or more people need visibility; that's usually where manual systems start to crack.",
  },
];

export function tierForScore(score: number): Tier {
  return TIERS.find((t) => score >= t.range[0] && score <= t.range[1]) ?? TIERS[0];
}
