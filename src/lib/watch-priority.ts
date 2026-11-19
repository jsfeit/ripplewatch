// Watch priority: a 0-100 rank of which competitors deserve attention, that works on day one.
//
// Momentum is a trend, and a trend needs history. A competitor added today has none, so Momentum honestly says "not
// enough history yet". Priority answers a different question that needs no history: right now, how much does this
// competitor deserve your attention? It is a rank, not a direction, and it is labeled that way everywhere it shows.
//
// Five parts, each with a cap so no single one decides the rank. The caps add to 100.
//   Relevance of what was found (40): recent signals weighted by how relevant the scoring step judged each one to
//     this company. Ten irrelevant signals are worth less than three that matter.
//   Deals lost to them (30): the strongest evidence a competitor matters. Each lost or churned deal counts, wins
//     against them count a little the other way. Zero until the company logs deals.
//   Market exposure (10): named in an industry development researched for this account (a regulator's rule, a shift in
//     buyer behavior). It is something happening around them, not something they did, so it is worth a little, not a lot.
//   Size and presence (12): hiring, reviews and buzz compared with the other competitors tracked, so "75 open roles"
//     means something next to 15 and 17.
//   Breadth (8): findings across several kinds of source (hiring and pricing and news) say more than one noisy kind.
//
// Pure and deterministic so every number can be explained and tested. No model call, no cost.
export type PriorityBand = "Watch closely" | "Keep an eye on" | "Background";

export type PriorityInput = {
  id: string;
  signals: { occurred_on: string; type?: string; relevance_score?: number | null }[];
  // Titles of industry developments that name this competitor.
  marketTrends?: string[];
  deals: { outcome: string }[];
  baseline: { openRoles: number | null; reviewRating: number | null; buzzMentions: number | null };
};

export type WatchPriority = {
  score: number;
  band: PriorityBand;
  // Plain-language reasons, strongest first, written so an assistant can read them straight to the person.
  reasons: string[];
  parts: { relevance: number; deals: number; presence: number; breadth: number; market: number };
};

const WINDOW_DAYS = 30;
const CAP = { relevance: 40, deals: 30, presence: 12, breadth: 8, market: 10 } as const;
const MARKET_POINTS_PER_TREND = 5;
// A signal with no relevance score yet (scoring runs after collection) counts as moderately relevant rather than zero.
const UNSCORED_RELEVANCE = 40;
// Relevance is ranked against the other competitors tracked, so a quiet set still produces an order. The floor stops a
// set where everything is weak from handing the top competitor full marks: it takes about this much weighted
// evidence (two signals scored 100, or five scored 40) to earn the full relevance share.
const RELEVANCE_FLOOR = 2;
const DEAL_POINTS_PER_LOSS = 10;
const DEAL_CREDIT_PER_WIN = 3;

function band(score: number): PriorityBand {
  if (score >= 60) return "Watch closely";
  if (score >= 35) return "Keep an eye on";
  return "Background";
}

// 0-1 position of a value among its peers, ties sharing the lower rank. Needs at least two peers to mean anything.
function peerShare(value: number | null, all: (number | null)[]): number {
  const present = all.filter((v): v is number => v !== null);
  if (value === null || present.length < 2) return 0;
  const max = Math.max(...present);
  const min = Math.min(...present);
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

export function computePriorities(inputs: PriorityInput[], now: Date = new Date()): Map<string, WatchPriority> {
  const cutoff = now.getTime() - WINDOW_DAYS * 86_400_000;
  const out = new Map<string, WatchPriority>();

  const rolesAll = inputs.map((i) => i.baseline.openRoles);
  const ratingAll = inputs.map((i) => i.baseline.reviewRating);
  const buzzAll = inputs.map((i) => i.baseline.buzzMentions);

  const weightedOf = (input: PriorityInput) =>
    input.signals
      .filter((s) => new Date(s.occurred_on).getTime() >= cutoff)
      .reduce((sum, s) => sum + (s.relevance_score ?? UNSCORED_RELEVANCE) / 100, 0);
  const bestWeighted = Math.max(RELEVANCE_FLOOR, ...inputs.map(weightedOf));

  for (const input of inputs) {
    const recent = input.signals.filter((s) => new Date(s.occurred_on).getTime() >= cutoff);
    const weighted = weightedOf(input);
    const relevance = Math.min(1, weighted / bestWeighted) * CAP.relevance;

    const lost = input.deals.filter((d) => d.outcome === "lost" || d.outcome === "churned").length;
    const won = input.deals.filter((d) => d.outcome === "won").length;
    const deals = Math.max(0, Math.min(CAP.deals, lost * DEAL_POINTS_PER_LOSS - won * DEAL_CREDIT_PER_WIN));

    // Hiring size counts most, then buzz, then reviews; a competitor with none of them recorded earns nothing here.
    const presence =
      (peerShare(input.baseline.openRoles, rolesAll) * 0.5 + peerShare(input.baseline.buzzMentions, buzzAll) * 0.3 + peerShare(input.baseline.reviewRating, ratingAll) * 0.2) *
      CAP.presence;

    const kinds = new Set(recent.map((s) => s.type).filter(Boolean)).size;
    const breadth = Math.min(1, Math.max(0, kinds - 1) / 3) * CAP.breadth;

    const trends = input.marketTrends ?? [];
    const market = Math.min(CAP.market, trends.length * MARKET_POINTS_PER_TREND);

    const score = Math.round(Math.min(100, relevance + deals + presence + breadth + market));

    const reasons: { weight: number; text: string }[] = [];
    if (lost > 0) reasons.push({ weight: deals, text: `${lost} lost ${lost === 1 ? "deal" : "deals"} logged against them` });
    if (recent.length > 0) {
      const strong = recent.filter((s) => (s.relevance_score ?? 0) >= 70).length;
      reasons.push({
        weight: relevance,
        text: strong > 0 ? `${recent.length} recent signals, ${strong} highly relevant to you` : `${recent.length} recent ${recent.length === 1 ? "signal" : "signals"}`,
      });
    }
    const scored = recent.filter((s) => s.relevance_score != null);
    if (scored.length >= 3 && scored.reduce((a, s) => a + (s.relevance_score ?? 0), 0) / scored.length < 25) {
      reasons.push({ weight: CAP.relevance * 0.4, text: "most of what was found is low relevance to your business so far" });
    }
    if (input.baseline.openRoles !== null && peerShare(input.baseline.openRoles, rolesAll) >= 0.75) {
      reasons.push({ weight: CAP.presence * 0.5, text: `${input.baseline.openRoles} open roles, the most you track` });
    }
    if (trends.length > 0) reasons.push({ weight: market, text: `named in a market development: ${trends[0]}` });
    if (kinds >= 3) reasons.push({ weight: breadth, text: `activity across ${kinds} kinds of source` });
    if (reasons.length === 0) reasons.push({ weight: 0, text: "little found so far" });

    out.set(input.id, {
      score,
      band: band(score),
      reasons: reasons.sort((a, b) => b.weight - a.weight).map((r) => r.text),
      parts: { relevance: Math.round(relevance), deals: Math.round(deals), presence: Math.round(presence), breadth: Math.round(breadth), market: Math.round(market) },
    });
  }
  return out;
}
