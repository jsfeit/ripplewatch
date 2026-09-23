"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ArrowUpRight, TrendingUp, Flame } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { InsightCallout } from "@/components/app/insight-callout";
import { Card, CardAvatar } from "@/components/app/card";
import { cn } from "@/lib/utils";
import {
  computeMomentum,
  MOMENTUM_STYLES,
  type MomentumComponent,
  type MomentumResult,
  type StateHistoryEntry,
} from "@/lib/momentum";
import { detectGoneQuiet, type GoneQuietResult } from "@/lib/gone-quiet";
import { MomentumQuadrant, type QuadrantCompetitor } from "./momentum-quadrant";
import type { Database, MarketGrowthDirection } from "@/lib/supabase/types";

type Competitor = Pick<Database["public"]["Tables"]["competitors"]["Row"], "id" | "name" | "created_at">;
type CompetitorPricing = Pick<Database["public"]["Tables"]["competitor_pricing"]["Row"], "tiers">;
type SignalRow = Database["public"]["Tables"]["signals"]["Row"];
type MomentumSignal = Pick<
  SignalRow,
  "competitor_id" | "type" | "sentiment" | "occurred_on" | "scored" | "relevance_score"
>;
type LatestSignal = Pick<SignalRow, "title">;
type MomentumWinLoss = Pick<
  Database["public"]["Tables"]["competitor_win_loss"]["Row"],
  "competitor_id" | "outcome" | "created_at"
>;
type MomentumStateHistoryEntry = StateHistoryEntry & { competitor_id: string };

function pricingSummary(record: CompetitorPricing | undefined): string {
  if (!record) return "Pricing not checked yet";
  const numericTiers = record.tiers.filter((t): t is typeof t & { price: number } => t.price !== null);
  if (numericTiers.length === 0) return "No public pricing";
  const cheapest = numericTiers.reduce((min, t) => (t.price < min.price ? t : min));
  return `From $${cheapest.price}${cheapest.price_period ? `/${cheapest.price_period}` : ""}`;
}

// Weight * |score|, not just |score| — a component with a big raw swing but
// low reliability weight (e.g. one stale signal) shouldn't outrank a
// smaller but well-supported one. This is what lets a row say "why" at a
// glance instead of making someone expand it to find out.
function topDriver(momentum: MomentumResult): MomentumComponent | null {
  let best: MomentumComponent | null = null;
  let bestMagnitude = 0;
  for (const component of Object.values(momentum.components)) {
    if (component.score === null) continue;
    const magnitude = Math.abs(component.score) * component.weight;
    if (magnitude > bestMagnitude) {
      bestMagnitude = magnitude;
      best = component;
    }
  }
  return best;
}

// Everything that used to be scattered across the Trends momentum cards
// (hiring/pricing/press/relevance breakdown) plus what
// previously required visiting News and Competitor Pricing separately
// (latest signal, price point) for a read on one specific competitor —
// one row per competitor, expandable for the detail. Replaces
// MomentumBoard as the dashboard's momentum surface; the old card grid is
// gone, not duplicated.
export function CompetitorOverview({
  competitors,
  momentumSignals,
  momentumWinLoss,
  momentumStateHistory,
  latestSignalByCompetitor,
  pricingByCompetitor,
  marketGrowthDirection,
}: {
  competitors: Competitor[];
  momentumSignals: MomentumSignal[];
  momentumWinLoss: MomentumWinLoss[];
  momentumStateHistory: MomentumStateHistoryEntry[];
  latestSignalByCompetitor: Record<string, LatestSignal>;
  pricingByCompetitor: Record<string, CompetitorPricing>;
  // Null when the Market panel hasn't generated yet — gone-quiet detection
  // just doesn't fire for anyone in that case (see detectGoneQuiet's market
  // gate), same as any other account still waiting on its first crawl.
  marketGrowthDirection: MarketGrowthDirection | null;
}) {
  const momentumByCompetitor = useMemo(() => {
    const byCompetitor = new Map<string, MomentumSignal[]>();
    for (const signal of momentumSignals) {
      const list = byCompetitor.get(signal.competitor_id) ?? [];
      list.push(signal);
      byCompetitor.set(signal.competitor_id, list);
    }
    const winLossByCompetitor = new Map<string, MomentumWinLoss[]>();
    // Unattributed entries (no competitor identified) can't fairly move
    // any one competitor's own win-rate component — see
    // churn-correlation.ts for where they're surfaced instead.
    for (const entry of momentumWinLoss) {
      if (!entry.competitor_id) continue;
      const list = winLossByCompetitor.get(entry.competitor_id) ?? [];
      list.push(entry);
      winLossByCompetitor.set(entry.competitor_id, list);
    }
    const stateHistoryByCompetitor = new Map<string, StateHistoryEntry[]>();
    for (const entry of momentumStateHistory) {
      const list = stateHistoryByCompetitor.get(entry.competitor_id) ?? [];
      list.push(entry);
      stateHistoryByCompetitor.set(entry.competitor_id, list);
    }
    return new Map(
      competitors.map((c) => [
        c.id,
        computeMomentum(
          byCompetitor.get(c.id) ?? [],
          winLossByCompetitor.get(c.id) ?? [],
          stateHistoryByCompetitor.get(c.id) ?? []
        ),
      ])
    );
  }, [competitors, momentumSignals, momentumWinLoss, momentumStateHistory]);

  // Independent of momentumByCompetitor: detectGoneQuiet reasons about raw
  // signal timing across every tracked competitor (peer comparison) plus
  // the market's own state, not about the computed momentum score itself.
  const goneQuietByCompetitor = useMemo(() => {
    const peerIds = competitors.map((c) => c.id);
    const map = new Map<string, GoneQuietResult | null>();
    for (const c of competitors) {
      map.set(
        c.id,
        detectGoneQuiet({
          competitorId: c.id,
          competitorCreatedAt: c.created_at,
          allSignals: momentumSignals,
          peerCompetitorIds: peerIds,
          marketGrowthDirection,
        })
      );
    }
    return map;
  }, [competitors, momentumSignals, marketGrowthDirection]);

  const sorted = useMemo(
    () =>
      [...competitors].sort((a, b) => {
        const scoreA = momentumByCompetitor.get(a.id)?.score;
        const scoreB = momentumByCompetitor.get(b.id)?.score;
        if (scoreA === null || scoreA === undefined) return scoreB === null || scoreB === undefined ? 0 : 1;
        if (scoreB === null || scoreB === undefined) return -1;
        return scoreB - scoreA;
      }),
    [competitors, momentumByCompetitor]
  );

  const [expanded, setExpanded] = useState(true);
  // Map defaults off, and its toggle button only renders at sm: and up
  // (see the JSX below) — a scatter plot needs real width to read, and a
  // phone-width user who somehow already had "map" selected (e.g. resized
  // down from desktop) would otherwise be stuck looking at a squeezed
  // chart with no visible way back to the list.
  const [view, setView] = useState<"list" | "map">("list");

  // Lazy initializer, not an inline Date.now() call, so this stays a pure
  // render — see daysAgoIso's equivalent server-side fix for the same rule.
  const [nowMs] = useState(() => Date.now());

  // Signal volume in the same 30-day window gone-quiet detection uses (see
  // gone-quiet.ts's PEER_WINDOW_DAYS) — the quadrant's dot-size dimension.
  const signalCountByCompetitor = useMemo(() => {
    const cutoff = nowMs - 30 * 86_400_000;
    const counts = new Map<string, number>();
    for (const s of momentumSignals) {
      if (new Date(s.occurred_on).getTime() < cutoff) continue;
      counts.set(s.competitor_id, (counts.get(s.competitor_id) ?? 0) + 1);
    }
    return counts;
  }, [momentumSignals, nowMs]);

  const quadrantCompetitors: QuadrantCompetitor[] = useMemo(
    () =>
      sorted.map((c) => ({
        id: c.id,
        name: c.name,
        momentum: momentumByCompetitor.get(c.id)!,
        goneQuiet: goneQuietByCompetitor.get(c.id) ?? null,
        signalCount: signalCountByCompetitor.get(c.id) ?? 0,
      })),
    [sorted, momentumByCompetitor, goneQuietByCompetitor, signalCountByCompetitor]
  );

  const heatingUpCount = sorted.filter((c) => momentumByCompetitor.get(c.id)?.label === "Heating up").length;
  const coolingCount = sorted.filter((c) => momentumByCompetitor.get(c.id)?.label === "Cooling").length;
  const goneQuietCount = sorted.filter((c) => goneQuietByCompetitor.get(c.id)).length;

  // The single answer to "what should I look at first," named directly
  // instead of asking someone to scan a sorted list of pills. Gone-quiet
  // competitors lead — they're rarer and, by construction, only ever shown
  // when the context around them (peers active, market moving) makes the
  // silence itself the interesting part, which "Heating up" alone doesn't
  // capture. "Heating up" (a real direction change) still beats just the
  // highest absolute score, since going from quiet to active is usually
  // more worth attention than a high but stable score. Capped at 2 total so
  // this stays a pointer, not a second copy of the list below it.
  type FocusItem =
    | { kind: "gone_quiet"; competitor: Competitor; goneQuiet: GoneQuietResult }
    | { kind: "heating_up"; competitor: Competitor; momentum: MomentumResult };
  const focusCompetitors = useMemo(() => {
    const quiet: FocusItem[] = sorted
      .filter((c) => goneQuietByCompetitor.get(c.id))
      .map((c) => ({ kind: "gone_quiet" as const, competitor: c, goneQuiet: goneQuietByCompetitor.get(c.id)! }));
    const heating: FocusItem[] = sorted
      .filter((c) => momentumByCompetitor.get(c.id)?.label === "Heating up")
      .map((c) => ({ kind: "heating_up" as const, competitor: c, momentum: momentumByCompetitor.get(c.id)! }));
    return [...quiet, ...heating].slice(0, 2);
  }, [sorted, momentumByCompetitor, goneQuietByCompetitor]);

  if (competitors.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No competitors yet"
        description="Add some in Settings to start tracking momentum."
      />
    );
  }

  return (
    <div>
      {focusCompetitors.length > 0 ? (
        <InsightCallout eyebrow="Focus here first" icon={<Flame className="size-3" />} className="mb-3">
          {focusCompetitors.map((item) => (
            <span key={item.competitor.id} className="mr-1 inline-block">
              <span className="font-medium text-foreground">{item.competitor.name}</span>{" "}
              {item.kind === "gone_quiet" ? (
                <>has gone quiet, and it&apos;s worth a look. {item.goneQuiet.reason}</>
              ) : (
                <>
                  is heating up
                  {(() => {
                    const driver = topDriver(item.momentum);
                    return driver ? `, driven by ${driver.label.toLowerCase()} (${driver.detail}).` : ".";
                  })()}
                </>
              )}
            </span>
          ))}
        </InsightCallout>
      ) : null}

      {/* Map needs real width to read as a scatter plot, so its toggle only
          renders at sm: and up — a phone-width visitor never sees it and
          stays on List, the default, rather than getting a squeezed chart
          with no way back. */}
      <div className="mb-2 hidden items-center gap-1 rounded-lg border border-border bg-secondary/30 p-1 sm:inline-flex">
        <button
          type="button"
          onClick={() => setView("list")}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium",
            view === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          List
        </button>
        <button
          type="button"
          onClick={() => setView("map")}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium",
            view === "map" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Map
        </button>
      </div>

      {view === "map" ? (
        <MomentumQuadrant competitors={quadrantCompetitors} />
      ) : (
        <>
          {/* Expanded by default — Momentum leads the dashboard now, so the
              full per-competitor list is the point of the section rather than
              something to reveal after a click. Still collapsible for anyone
              who just wants the summary line. */}
          <button
            type="button"
            data-tour="competitor-card"
            onClick={() => setExpanded((e) => !e)}
            className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left hover:border-primary/40"
          >
            <span className="text-sm">
              <span className="font-semibold">{competitors.length}</span>{" "}
              {competitors.length === 1 ? "competitor" : "competitors"} tracked
              {heatingUpCount > 0 ? (
                <span className="text-muted-foreground">
                  {" · "}
                  <span className="font-medium text-foreground">{heatingUpCount}</span> heating up
                </span>
              ) : null}
              {coolingCount > 0 ? (
                <span className="text-muted-foreground">
                  {" · "}
                  <span className="font-medium text-foreground">{coolingCount}</span> cooling
                </span>
              ) : null}
              {goneQuietCount > 0 ? (
                <span className="text-muted-foreground">
                  {" · "}
                  <span className="font-medium text-foreground">{goneQuietCount}</span> gone quiet
                </span>
              ) : null}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
              {expanded ? "Collapse" : "Show all"}
              <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
            </span>
          </button>

          {expanded ? (
            <div className="mt-2.5 space-y-2.5">
              {sorted.map((competitor) => (
                <CompetitorRow
                  key={competitor.id}
                  competitor={competitor}
                  momentum={momentumByCompetitor.get(competitor.id)!}
                  goneQuiet={goneQuietByCompetitor.get(competitor.id) ?? null}
                  latestSignal={latestSignalByCompetitor[competitor.id]}
                  pricingRecord={pricingByCompetitor[competitor.id]}
                />
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

// A quiet diverging bar next to the score/label pill — without it, a list of
// mostly-Steady competitors reads as a wall of near-identical gray pills with
// no visual way to tell "barely steady" from "solidly steady" at a glance.
// Fixed track spanning the full -100..+100 range; the fill grows from the
// center toward whichever side the score leans, in the same emerald/rose
// used by MOMENTUM_STYLES so it reads as the same signal, not a second
// palette. A Steady score near zero correctly shows almost no fill — the
// bar itself is the "how far from neutral" read, not just a color swatch.
function MomentumMeter({ score }: { score: number | null }) {
  if (score === null) return null;
  const clamped = Math.max(-100, Math.min(100, score));
  const magnitudePercent = Math.abs(clamped) / 2; // half the track = a magnitude of 100
  const positive = clamped > 0;
  return (
    <div
      className="relative h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-secondary"
      role="img"
      aria-label={`Momentum ${clamped > 0 ? "+" : ""}${clamped} out of a possible -100 to +100`}
    >
      <div
        className={cn("absolute inset-y-0 rounded-full", positive ? "bg-emerald-500" : "bg-rose-500")}
        style={positive ? { left: "50%", width: `${magnitudePercent}%` } : { right: "50%", width: `${magnitudePercent}%` }}
      />
    </div>
  );
}

function CompetitorRow({
  competitor,
  momentum,
  goneQuiet,
  latestSignal,
  pricingRecord,
}: {
  competitor: Competitor;
  momentum: MomentumResult;
  goneQuiet: GoneQuietResult | null;
  latestSignal: LatestSignal | undefined;
  pricingRecord: CompetitorPricing | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMomentumData = momentum.score !== null;
  // Named here so the collapsed row already answers "why," instead of
  // making someone expand every row just to find the one component that
  // actually moved the score.
  const driver = hasMomentumData ? topDriver(momentum) : null;
  // goneQuiet overrides the plain score-derived label — see gone-quiet.ts.
  // The raw score/driver stay available underneath (an override, not a
  // recompute), just not shown here: a number next to "Gone quiet" would
  // read as a magnitude when the whole point is that magnitude is the
  // wrong lens for this state.
  const displayLabel = goneQuiet ? "Gone quiet" : momentum.label;

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <CardAvatar seed={competitor.name} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold">{competitor.name}</p>
              <Link
                href={`/app/competitors/${competitor.id}`}
                className="flex shrink-0 items-center gap-0.5 text-xs text-primary hover:underline"
              >
                Fact sheet
                <ArrowUpRight className="size-3" />
              </Link>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {latestSignal ? latestSignal.title : "No signal yet"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 sm:gap-x-4">
          <span className="text-xs text-muted-foreground">{pricingSummary(pricingRecord)}</span>
          <MomentumMeter score={momentum.score} />
          <div className="flex flex-col items-end gap-0.5">
            <button
              type="button"
              onClick={() => (hasMomentumData || goneQuiet) && setExpanded((e) => !e)}
              disabled={!hasMomentumData && !goneQuiet}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1",
                MOMENTUM_STYLES[displayLabel],
                (hasMomentumData || goneQuiet) && "cursor-pointer"
              )}
            >
              {hasMomentumData && !goneQuiet ? (
                <span className="text-xs font-bold tabular-nums">
                  {momentum.score! > 0 ? "+" : ""}
                  {momentum.score}
                </span>
              ) : null}
              <span className="text-xs font-semibold whitespace-nowrap">{displayLabel}</span>
              {hasMomentumData && momentum.confidence === "low" && !goneQuiet ? (
                <span
                  className="text-[10px] font-medium whitespace-nowrap opacity-70"
                  title="Based on limited data. This score may shift as more signals and win/loss data come in."
                >
                  (limited data)
                </span>
              ) : null}
              {hasMomentumData || goneQuiet ? (
                <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
              ) : null}
            </button>
            {goneQuiet ? (
              <span className="max-w-[180px] text-right text-[10px] text-muted-foreground">Tap to see why</span>
            ) : driver ? (
              <span className="max-w-[180px] text-right text-[10px] text-muted-foreground">{driver.label}</span>
            ) : null}
          </div>
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-dashed border-border pt-3">
          {goneQuiet ? (
            <p className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-2.5 text-[11.5px] leading-relaxed text-foreground">
              {goneQuiet.reason}
            </p>
          ) : null}
          {hasMomentumData ? (
            <div className="space-y-1 text-[11px]">
              {Object.values(momentum.components).map((c) => (
                <div key={c.label} className="flex items-center justify-between text-muted-foreground">
                  <span>{c.label}</span>
                  <span className="tabular-nums">{c.detail}</span>
                </div>
              ))}
            </div>
          ) : null}

        </div>
      ) : null}
    </Card>
  );
}
