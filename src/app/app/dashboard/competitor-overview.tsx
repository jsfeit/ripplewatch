"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ArrowUpRight, TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { Card, CardAvatar } from "@/components/app/card";
import { cn } from "@/lib/utils";
import { computeMomentum, MOMENTUM_STYLES, type MomentumResult, type StateHistoryEntry } from "@/lib/momentum";
import type { Database } from "@/lib/supabase/types";

type Competitor = Pick<Database["public"]["Tables"]["competitors"]["Row"], "id" | "name">;
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
}: {
  competitors: Competitor[];
  momentumSignals: MomentumSignal[];
  momentumWinLoss: MomentumWinLoss[];
  momentumStateHistory: MomentumStateHistoryEntry[];
  latestSignalByCompetitor: Record<string, LatestSignal>;
  pricingByCompetitor: Record<string, CompetitorPricing>;
}) {
  const momentumByCompetitor = useMemo(() => {
    const byCompetitor = new Map<string, MomentumSignal[]>();
    for (const signal of momentumSignals) {
      const list = byCompetitor.get(signal.competitor_id) ?? [];
      list.push(signal);
      byCompetitor.set(signal.competitor_id, list);
    }
    const winLossByCompetitor = new Map<string, MomentumWinLoss[]>();
    for (const entry of momentumWinLoss) {
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

  const heatingUpCount = sorted.filter((c) => momentumByCompetitor.get(c.id)?.label === "Heating up").length;
  const coolingCount = sorted.filter((c) => momentumByCompetitor.get(c.id)?.label === "Cooling").length;

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
              latestSignal={latestSignalByCompetitor[competitor.id]}
              pricingRecord={pricingByCompetitor[competitor.id]}
            />
          ))}
        </div>
      ) : null}
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
  latestSignal,
  pricingRecord,
}: {
  competitor: Competitor;
  momentum: MomentumResult;
  latestSignal: LatestSignal | undefined;
  pricingRecord: CompetitorPricing | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMomentumData = momentum.score !== null;

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

        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <span className="text-xs text-muted-foreground">{pricingSummary(pricingRecord)}</span>
          <MomentumMeter score={momentum.score} />
          <button
            type="button"
            onClick={() => hasMomentumData && setExpanded((e) => !e)}
            disabled={!hasMomentumData}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1",
              MOMENTUM_STYLES[momentum.label],
              hasMomentumData && "cursor-pointer"
            )}
          >
            {hasMomentumData ? (
              <span className="text-xs font-bold tabular-nums">
                {momentum.score! > 0 ? "+" : ""}
                {momentum.score}
              </span>
            ) : null}
            <span className="text-xs font-semibold whitespace-nowrap">{momentum.label}</span>
            {hasMomentumData && momentum.confidence === "low" ? (
              <span
                className="text-[10px] font-medium whitespace-nowrap opacity-70"
                title="Based on limited data. This score may shift as more signals and win/loss data come in."
              >
                (limited data)
              </span>
            ) : null}
            {hasMomentumData ? (
              <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
            ) : null}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-dashed border-border pt-3">
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
