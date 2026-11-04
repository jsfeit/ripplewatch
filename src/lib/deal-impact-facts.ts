import { THEME_SIGNAL_TYPES, DEAL_THEME_LABELS, isDealTheme } from "@/lib/deal-themes";
import { computeDealCoverage, dealDate, type DealCoverage } from "@/lib/deal-coverage";

// Everything here is computed in code. The model that writes the findings only sees these numbers and
// is told not to invent others, so a count or a date in a finding can always be traced to this file.
// Many losses never name who won, so the unit of analysis is the REASON a deal was lost; competitor
// moves are candidate explanations, matched on timing, never claimed as the cause.

export type FactDeal = {
  outcome: "won" | "lost" | "churned";
  closed_on: string | null;
  created_at: string;
  reason: string | null;
  reason_themes: string[];
  reason_detail: string | null;
  competitor_id: string | null;
  amount: number | null;
};

export type FactSignal = { competitor_id: string; type: string; title: string; occurred_on: string; relevance_score: number | null };
export type FactMomentum = { competitorId: string; label: string; score: number | null };
export type FactNote = {
  body: string;
  kind: string;
  status: string | null;
  product_areas: string[];
  themes: string[];
  effective_on: string;
  expected_on: string | null;
};

export type ImpactFactsInput = {
  today: string;
  deals: FactDeal[];
  competitors: { id: string; name: string }[];
  signals: FactSignal[];
  momentum: FactMomentum[];
  notes: FactNote[];
};

const DAY = 86400000;

function addDays(date: string, days: number): string {
  return new Date(new Date(date).getTime() + days * DAY).toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY);
}

const STOP = new Set(["the", "and", "for", "with", "our", "their", "that", "this", "from", "into", "support", "feature", "features"]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

// Two short phrases refer to the same thing when one contains the other or they share a word.
export function sameArea(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x.includes(y) || y.includes(x)) return true;
  const tb = new Set(tokens(b));
  return tokens(a).some((t) => tb.has(t));
}

function trimText(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export type ThemeFact = {
  theme: string;
  label: string;
  lostTotal: number;
  lostLast90: number;
  lostPrior90: number;
  trend: "rising" | "falling" | "flat" | "new";
  shareOfLosses: number;
  amountLost: number | null;
  topDetails: { detail: string; count: number }[];
  namedCompetitors: { name: string; count: number }[];
  examples: string[];
  candidateMoves: {
    competitor: string;
    type: string;
    title: string;
    occurredOn: string;
    themedLossesInNext30Days: number;
    expectedInAnyOther30Days: number;
  }[];
};

export type NoteFact = {
  kind: string;
  status: string | null;
  text: string;
  productAreas: string[];
  effectiveOn: string;
  expectedOn: string | null;
  lossesItCouldAddress: number;
  lossesItCouldAddressLast90: number;
};

export type ImpactFacts = {
  today: string;
  coverage: DealCoverage;
  losses: { total: number; last90: number; prior90: number; unattributedPct: number };
  themes: ThemeFact[];
  competitors: { name: string; lostTo: number; wonAgainst: number; lostLast90: number; momentum: string | null; momentumScore: number | null }[];
  notes: NoteFact[];
  timingReliable: boolean;
};

export function computeImpactFacts(input: ImpactFactsInput): ImpactFacts {
  const { today, competitors } = input;
  const nameById = new Map(competitors.map((c) => [c.id, c.name]));
  const coverage = computeDealCoverage(input.deals);
  const timingReliable = coverage.pctDated >= 50 && coverage.monthsSpan >= 2;

  const last90Start = addDays(today, -90);
  const prior90Start = addDays(today, -180);

  const lost = input.deals
    .filter((d) => d.outcome === "lost" || d.outcome === "churned")
    .map((d) => ({ ...d, date: dealDate(d) }));
  const last90 = lost.filter((d) => d.date >= last90Start);
  const prior90 = lost.filter((d) => d.date >= prior90Start && d.date < last90Start);
  const monthsSpan = Math.max(1, coverage.monthsSpan);

  const themeNames = new Set<string>();
  for (const d of lost) for (const t of d.reason_themes) if (isDealTheme(t)) themeNames.add(t);

  const themes: ThemeFact[] = [];
  for (const theme of themeNames) {
    const inTheme = lost.filter((d) => d.reason_themes.includes(theme));
    if (inTheme.length < 2) continue;
    const recent = inTheme.filter((d) => d.date >= last90Start).length;
    const prior = inTheme.filter((d) => d.date >= prior90Start && d.date < last90Start).length;
    const trend: ThemeFact["trend"] =
      prior === 0 && recent >= 2 ? "new" : recent >= prior + 2 && recent >= prior * 1.5 ? "rising" : prior >= recent + 2 && prior >= recent * 1.5 ? "falling" : "flat";

    const detailCounts = new Map<string, number>();
    for (const d of inTheme) if (d.reason_detail) detailCounts.set(d.reason_detail, (detailCounts.get(d.reason_detail) ?? 0) + 1);
    const compCounts = new Map<string, number>();
    for (const d of inTheme) {
      const n = d.competitor_id ? nameById.get(d.competitor_id) : null;
      if (n) compCounts.set(n, (compCounts.get(n) ?? 0) + 1);
    }
    const withAmount = inTheme.filter((d) => d.amount !== null);

    // Candidate moves: competitor activity of a kind that could explain this theme, and whether the
    // theme's losses were higher than usual in the 30 days after it.
    const candidateMoves: ThemeFact["candidateMoves"] = [];
    const types = THEME_SIGNAL_TYPES[theme as keyof typeof THEME_SIGNAL_TYPES] ?? [];
    if (timingReliable && types.length > 0) {
      const baselinePer30 = (inTheme.length / monthsSpan) * 1; // losses per ~30 days over the whole history
      const moves = input.signals
        .filter((s) => types.includes(s.type) && s.occurred_on >= addDays(today, -150))
        .sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0))
        .slice(0, 6);
      for (const s of moves) {
        const after = inTheme.filter((d) => {
          const gap = daysBetween(s.occurred_on, d.date);
          return gap >= 0 && gap <= 30;
        }).length;
        // Only moves with enough elapsed time to have shown an effect are worth naming.
        if (daysBetween(s.occurred_on, today) < 14) continue;
        candidateMoves.push({
          competitor: nameById.get(s.competitor_id) ?? "a tracked competitor",
          type: s.type,
          title: trimText(s.title, 120),
          occurredOn: s.occurred_on,
          themedLossesInNext30Days: after,
          expectedInAnyOther30Days: Math.round(baselinePer30 * 10) / 10,
        });
      }
    }

    themes.push({
      theme,
      label: DEAL_THEME_LABELS[theme as keyof typeof DEAL_THEME_LABELS],
      lostTotal: inTheme.length,
      lostLast90: recent,
      lostPrior90: prior,
      trend,
      shareOfLosses: lost.length ? Math.round((inTheme.length / lost.length) * 100) : 0,
      amountLost: withAmount.length ? withAmount.reduce((a, d) => a + (d.amount ?? 0), 0) : null,
      topDetails: [...detailCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([detail, count]) => ({ detail, count })),
      namedCompetitors: [...compCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, count]) => ({ name, count })),
      examples: inTheme
        .filter((d) => d.reason)
        .slice(-3)
        .map((d) => trimText(d.reason as string, 140)),
      candidateMoves: candidateMoves.slice(0, 4),
    });
  }
  themes.sort((a, b) => b.lostLast90 - a.lostLast90 || b.lostTotal - a.lostTotal);

  const momentumById = new Map(input.momentum.map((m) => [m.competitorId, m]));
  const compFacts = competitors
    .map((c) => {
      const mine = input.deals.filter((d) => d.competitor_id === c.id);
      const m = momentumById.get(c.id);
      return {
        name: c.name,
        lostTo: mine.filter((d) => d.outcome !== "won").length,
        wonAgainst: mine.filter((d) => d.outcome === "won").length,
        lostLast90: mine.filter((d) => d.outcome !== "won" && dealDate(d) >= last90Start).length,
        momentum: m?.label ?? null,
        momentumScore: m?.score ?? null,
      };
    })
    .filter((c) => c.lostTo + c.wonAgainst > 0 || c.momentum === "Heating up")
    .sort((a, b) => b.lostTo - a.lostTo)
    .slice(0, 8);

  const roadmapAndOther = [...input.notes].sort((a, b) => (a.effective_on < b.effective_on ? 1 : -1)).slice(0, 12);
  const notes: NoteFact[] = roadmapAndOther.map((n) => {
    const matches = lost.filter((d) => {
      const themeHit = n.themes.length === 0 || d.reason_themes.some((t) => n.themes.includes(t));
      if (!themeHit) return false;
      if (n.product_areas.length === 0) return n.themes.length > 0;
      const detail = d.reason_detail ?? d.reason ?? "";
      return detail !== "" && n.product_areas.some((a) => sameArea(a, detail));
    });
    return {
      kind: n.kind,
      status: n.status,
      text: trimText(n.body, 240),
      productAreas: n.product_areas,
      effectiveOn: n.effective_on,
      expectedOn: n.expected_on,
      lossesItCouldAddress: matches.length,
      lossesItCouldAddressLast90: matches.filter((d) => d.date >= last90Start).length,
    };
  });

  const unattributed = lost.filter((d) => !d.competitor_id).length;
  return {
    today,
    coverage,
    losses: {
      total: lost.length,
      last90: last90.length,
      prior90: prior90.length,
      unattributedPct: lost.length ? Math.round((unattributed / lost.length) * 100) : 0,
    },
    themes: themes.slice(0, 6),
    competitors: compFacts,
    notes,
    timingReliable,
  };
}
