// MOCK DATA — fictional competitors & signals for the app-shell phase.
// The real scraping + LLM relevance-scoring pipeline is a later build phase;
// everything in this file stands in for that pipeline's output.

export type SignalType =
  | "pricing"
  | "job_posting"
  | "review"
  | "news"
  | "funding";

export type Competitor = {
  id: string;
  name: string;
  domain: string;
  initial: string;
  colorClass: string;
};

// Shaped to match the real `signals` table (flat relevance fields) so
// AlertCard can render mock and real signals identically.
export type Signal = {
  id: string;
  competitorId: string;
  type: SignalType;
  title: string;
  summary: string;
  date: string; // ISO
  scored: boolean;
  relevanceLevel?: "High" | "Medium" | "Low";
  relevanceReasoning?: string;
};

export const SIGNAL_TYPE_LABELS: Record<SignalType, string> = {
  pricing: "Pricing / site change",
  job_posting: "Job posting",
  review: "Review signal",
  news: "News",
  funding: "Funding",
};

export const MOCK_COMPETITORS: Competitor[] = [
  { id: "parano", name: "Parano.ai", domain: "parano.ai", initial: "P", colorClass: "bg-chart-1" },
  { id: "rivalsense", name: "RivalSense", domain: "rivalsense.io", initial: "R", colorClass: "bg-chart-2" },
  { id: "compttr", name: "Compttr", domain: "compttr.com", initial: "C", colorClass: "bg-chart-3" },
  { id: "signalstack", name: "SignalStack", domain: "signalstack.com", initial: "S", colorClass: "bg-chart-4" },
];

export const MOCK_SIGNALS: Signal[] = [
  {
    id: "sig-1",
    competitorId: "parano",
    type: "pricing",
    title: "Parano.ai dropped their entry tier from $99 to $69/mo",
    summary:
      "Entry-tier price cut of ~30%, still capped at 5 competitors tracked. Landing page now leads with \"cheapest AI competitive intel.\"",
    date: "2026-07-13",
    scored: true,
    relevanceLevel: "High",
    relevanceReasoning:
      "You've lost 2 deals in the last month to buyers who cited price as the deciding factor. This directly narrows your price gap against a name that keeps coming up in those conversations.",
  },
  {
    id: "sig-2",
    competitorId: "rivalsense",
    type: "review",
    title: "New G2 review calls out RivalSense's onboarding as 'confusing'",
    summary:
      "3-star review, 2nd this month citing onboarding friction. Reviewer specifically mentions not understanding what a 'signal' means without support help.",
    date: "2026-07-12",
    scored: true,
    relevanceLevel: "High",
    relevanceReasoning:
      "Your ICP is self-serve marketing leads with no analyst on staff — onboarding clarity is one of your stated wedge differentiators. This is a live example to reference in sales conversations.",
  },
  {
    id: "sig-3",
    competitorId: "compttr",
    type: "job_posting",
    title: "Compttr posted 2 openings for 'Competitive Intelligence Analyst'",
    summary:
      "Roles are analyst-facing, reporting into a new 'Customer Success' lead. Both listings mention supporting an 'enterprise tier' rollout.",
    date: "2026-07-11",
    scored: true,
    relevanceLevel: "Medium",
    relevanceReasoning:
      "Signals a move upmarket toward analyst-led service, which could pull them away from your self-serve buyer segment — worth tracking but not an immediate threat to your ICP.",
  },
  {
    id: "sig-4",
    competitorId: "signalstack",
    type: "funding",
    title: "SignalStack raised a $6M seed round",
    summary: "Led by a growth-stage fund; press release mentions 'expanding signal coverage to social platforms.'",
    date: "2026-07-10",
    scored: false,
  },
  {
    id: "sig-5",
    competitorId: "parano",
    type: "news",
    title: "Parano.ai featured in a roundup: 'Best AI tools for startup marketers'",
    summary: "Listicle placement, no direct quote from their team. Fifth of seven tools mentioned.",
    date: "2026-07-09",
    scored: false,
  },
  {
    id: "sig-6",
    competitorId: "rivalsense",
    type: "pricing",
    title: "RivalSense added a 14-day free trial to all tiers",
    summary: "Previously demo-gated; now self-serve trial with a credit card required after day 14.",
    date: "2026-07-08",
    scored: true,
    relevanceLevel: "Medium",
    relevanceReasoning:
      "Lowers their self-serve friction, which matters since you compete for the same PLG-leaning buyers, but your onboarding differentiator likely still wins the eval.",
  },
  {
    id: "sig-7",
    competitorId: "compttr",
    type: "review",
    title: "Compttr's average G2 rating ticked up to 4.6",
    summary: "Two new 5-star reviews this week, both praising 'fast Slack alerts.'",
    date: "2026-07-07",
    scored: false,
  },
  {
    id: "sig-8",
    competitorId: "signalstack",
    type: "job_posting",
    title: "SignalStack hiring a Head of Partnerships",
    summary: "Focused on data-source partnerships per the listing, not go-to-market.",
    date: "2026-07-05",
    scored: false,
  },
  {
    id: "sig-9",
    competitorId: "parano",
    type: "pricing",
    title: "Parano.ai removed competitor-count caps on their top tier",
    summary: "Top tier now says 'unlimited competitors' where it previously capped at 15.",
    date: "2026-07-03",
    scored: true,
    relevanceLevel: "Low",
    relevanceReasoning:
      "This only affects their top tier, which targets larger teams than your typical 5–100 person ICP — unlikely to come up in your deals.",
  },
  {
    id: "sig-10",
    competitorId: "rivalsense",
    type: "news",
    title: "RivalSense mentioned in a VC newsletter's 'tools to watch' section",
    summary: "Brief mention, no direct competitive claims made.",
    date: "2026-07-01",
    scored: false,
  },
];

export function getCompetitor(id: string): Competitor | undefined {
  return MOCK_COMPETITORS.find((c) => c.id === id);
}

export function getSignalsForCompetitor(id: string): Signal[] {
  return MOCK_SIGNALS.filter((s) => s.competitorId === id).sort((a, b) =>
    a.date < b.date ? 1 : -1
  );
}
