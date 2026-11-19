// Learning what matters to this customer.
//
// Every company is hurt by different competitor behavior: one loses deals after a competitor's pricing change, another
// after a launch. With enough of its own lost deals, this works out which kinds of activity tend to come before them, by
// comparing the 45 days before each loss with ordinary 45-day windows for the same competitors. A type that shows up
// before losses much more often than usual earns more weight in the watch priority; one that does not earns less.
//
// Conservative on purpose. Nothing changes until there are 8 losses naming a competitor, a type needs to appear before
// at least 3 of them, and the multiplier is capped between 0.6 and 1.5, so a thin history can nudge the ranking but never
// take it over. It describes timing, not cause, and says so.
export type LearnDeal = { outcome: string; competitor_id: string | null; closed: string }; // closed: YYYY-MM-DD
export type LearnSignal = { competitor_id: string; type: string; occurred_on: string };

export type LearnedWeights = {
  enough: boolean;
  losses: number;
  multipliers: Record<string, number>; // 1 when unlearned
  insights: { type: string; label: string; before: number; ofLosses: number; ordinaryPct: number; sentence: string }[];
};

const DAY = 86_400_000;
const WINDOW = 30;
const MIN_LOSSES = 8;
const MIN_APPEARANCES = 3;
const LABEL: Record<string, string> = {
  pricing: "pricing changes",
  product_change: "product changes",
  job_posting: "hiring pushes",
  news: "news coverage",
  funding: "funding news",
  review: "review changes",
  seo: "search changes",
};

export function learnSignalWeights(deals: LearnDeal[], signals: LearnSignal[], now: Date = new Date()): LearnedWeights {
  const losses = deals.filter((d) => (d.outcome === "lost" || d.outcome === "churned") && d.competitor_id);
  const types = [...new Set(signals.map((s) => s.type))];
  const none: LearnedWeights = { enough: false, losses: losses.length, multipliers: Object.fromEntries(types.map((t) => [t, 1])), insights: [] };
  if (losses.length < MIN_LOSSES) return none;

  const byCompetitor = new Map<string, LearnSignal[]>();
  for (const s of signals) byCompetitor.set(s.competitor_id, [...(byCompetitor.get(s.competitor_id) ?? []), s]);
  const typesIn = (competitorId: string, end: number) => {
    const set = new Set<string>();
    for (const s of byCompetitor.get(competitorId) ?? []) {
      const t = new Date(s.occurred_on).getTime();
      if (t >= end - WINDOW * DAY && t < end) set.add(s.type);
    }
    return set;
  };

  // What came before each loss.
  const before = new Map<string, number>();
  for (const l of losses) for (const t of typesIn(l.competitor_id!, new Date(l.closed).getTime())) before.set(t, (before.get(t) ?? 0) + 1);

  // How often each type shows up in an ordinary window: weekly samples across the last 180 days, for every competitor
  // that has a loss, so the comparison is against the same companies.
  const comps = [...new Set(losses.map((l) => l.competitor_id!))];
  let samples = 0;
  const ordinary = new Map<string, number>();
  for (const c of comps) {
    for (let w = 0; w < 26; w++) {
      samples++;
      for (const t of typesIn(c, now.getTime() - w * 7 * DAY)) ordinary.set(t, (ordinary.get(t) ?? 0) + 1);
    }
  }

  const multipliers: Record<string, number> = {};
  const insights: LearnedWeights["insights"] = [];
  for (const t of types) {
    const b = before.get(t) ?? 0;
    // Smoothed so a type seen rarely cannot produce a wild ratio.
    const lossRate = (b + 0.5) / (losses.length + 1);
    const baseRate = ((ordinary.get(t) ?? 0) + 0.5) / (samples + 1);
    const lift = lossRate / baseRate;
    const m = b >= MIN_APPEARANCES ? Math.max(0.6, Math.min(1.5, 1 + 0.5 * Math.log(lift))) : 1;
    multipliers[t] = Math.round(m * 100) / 100;
    if (b >= MIN_APPEARANCES && lift >= 1.4) {
      const label = LABEL[t] ?? t;
      const ordinaryPct = Math.round((ordinary.get(t) ?? 0) / samples * 100);
      insights.push({
        type: t,
        label,
        before: b,
        ofLosses: losses.length,
        ordinaryPct,
        sentence: `${label[0].toUpperCase()}${label.slice(1)} came before ${b} of your ${losses.length} lost deals, against about ${ordinaryPct}% of ordinary weeks. Timing, not proof of cause.`,
      });
    }
  }
  return { enough: true, losses: losses.length, multipliers, insights: insights.sort((a, b) => b.before - a.before) };
}
