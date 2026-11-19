import { DEAL_THEME_LABELS, isDealTheme } from "@/lib/deal-themes";

// What a competitor is costing this company, from the company's own logged deals (or churn, for consumer companies).
// Momentum says what a competitor is doing; this says whether it matters, which is the part a person acts on.
// Computed only from deals that name the competitor, so it never claims more than the data says. Pure and deterministic.
export type CostDeal = {
  outcome: string;
  competitor_id: string | null;
  amount: number | null;
  segment: string | null;
  reason_themes: string[] | null;
};

export type CompetitorCost = {
  lost: number; // lost plus churned deals that name this competitor
  won: number;
  lostAmount: number | null; // null when none of the lost deals carry an amount
  shareOfLosses: number | null; // 0-1: of all losses naming any competitor, how many name this one
  topReasons: string[]; // plain labels, most common first
  contestedSegment: { name: string; lost: number; won: number } | null;
  headline: string | null; // null until at least one deal names them
};

const money = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}m` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`);

export function computeCompetitorCosts(competitorIds: string[], deals: CostDeal[]): Map<string, CompetitorCost> {
  const isLoss = (d: CostDeal) => d.outcome === "lost" || d.outcome === "churned";
  const namedLosses = deals.filter((d) => isLoss(d) && d.competitor_id).length;
  const out = new Map<string, CompetitorCost>();

  for (const id of competitorIds) {
    const mine = deals.filter((d) => d.competitor_id === id);
    const losses = mine.filter(isLoss);
    const won = mine.filter((d) => d.outcome === "won").length;

    const amounts = losses.map((d) => d.amount).filter((a): a is number => typeof a === "number" && a > 0);
    const lostAmount = amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) : null;

    const themeCounts = new Map<string, number>();
    for (const d of losses) for (const t of d.reason_themes ?? []) if (isDealTheme(t)) themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
    const topReasons = [...themeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([t]) => DEAL_THEME_LABELS[t as keyof typeof DEAL_THEME_LABELS].toLowerCase());

    // The segment where they take the most from you. Needs at least two deals in it, so one odd deal isn't a pattern.
    const segs = new Map<string, { lost: number; won: number }>();
    for (const d of mine) {
      const key = d.segment?.trim();
      if (!key) continue;
      const row = segs.get(key) ?? { lost: 0, won: 0 };
      if (isLoss(d)) row.lost++;
      else if (d.outcome === "won") row.won++;
      segs.set(key, row);
    }
    const best = [...segs.entries()].filter(([, v]) => v.lost + v.won >= 2).sort((a, b) => b[1].lost - a[1].lost)[0];
    const contestedSegment = best && best[1].lost > 0 ? { name: best[0], ...best[1] } : null;

    let headline: string | null = null;
    if (losses.length > 0) {
      let first = `Named in ${losses.length} of your ${namedLosses} lost ${namedLosses === 1 ? "deal" : "deals"} that name a competitor`;
      if (lostAmount !== null) first += ` (about ${money(lostAmount)})`;
      const parts = [first];
      if (topReasons.length > 0) parts.push(`mostly on ${topReasons.join(" and ")}`);
      if (contestedSegment) parts.push(`hardest in ${contestedSegment.name} (${contestedSegment.lost} lost, ${contestedSegment.won} won)`);
      headline = parts.join(", ") + ".";
    } else if (won > 0) {
      headline = `You have won ${won} ${won === 1 ? "deal" : "deals"} against them and lost none that name them.`;
    }

    out.set(id, {
      lost: losses.length,
      won,
      lostAmount,
      shareOfLosses: namedLosses > 0 ? losses.length / namedLosses : null,
      topReasons,
      contestedSegment,
      headline,
    });
  }
  return out;
}
