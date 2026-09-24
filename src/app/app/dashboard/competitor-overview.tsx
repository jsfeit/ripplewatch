"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ArrowUpRight,
  TrendingUp,
  Flame,
  Moon,
  Newspaper,
  Briefcase,
  DollarSign,
  Package,
  Target,
  Trophy,
  GitBranch,
  Star,
  MessageSquare,
  Megaphone,
  Phone,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
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
  "competitor_id" | "type" | "sentiment" | "occurred_on" | "scored" | "relevance_score" | "title" | "url"
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

// One glance icon per momentum component, keyed by MomentumComponent.label
// exactly as momentum.ts defines it — gives a driver a visual identity
// instead of only ever being a text label, both in a compact row and in
// the bigger Focus spotlight cards below.
const DRIVER_ICONS: Record<string, LucideIcon> = {
  Hiring: Briefcase,
  "Pricing activity": DollarSign,
  "Product changes": Package,
  "Press & funding": Newspaper,
  "Relevance trend": Target,
  "Win rate trend": Trophy,
  "Product activity (GitHub)": GitBranch,
  "Review sentiment (G2/Capterra)": Star,
  "Buzz (Reddit/Hacker News)": MessageSquare,
  "Ad activity (Meta)": Megaphone,
  "Call mentions (Gong/Zoom)": Phone,
};

function DriverIcon({ label, className }: { label: string; className?: string }) {
  const Icon = DRIVER_ICONS[label];
  if (!Icon) return null;
  return <Icon className={className} />;
}

// Module scope, not local to CompetitorOverview, so SpotlightCard (a
// sibling component, not a closure) can take one as a prop.
type FocusItem =
  | { kind: "gone_quiet"; competitor: Competitor; goneQuiet: GoneQuietResult }
  | { kind: "heating_up"; competitor: Competitor; momentum: MomentumResult; driver: MomentumComponent };

// Weight * |score|, not just |score| — a component with a big raw swing but
// low reliability weight (e.g. one stale signal) shouldn't outrank a
// smaller but well-supported one. This is what lets a row say "why" at a
// glance instead of making someone expand it to find out.
//
// requireWellSupported restricts the search to components that have
// cleared MIN_SIGNAL_EVIDENCE (see momentum.ts) — used for the Focus
// banner below, which headlines one specific reason and shouldn't lead
// with a component whose score came from a single thin data point, even
// if that component happens to have the largest raw swing. The row-level
// call (no restriction) still surfaces whatever actually moved the score,
// thin or not — expanding a row is an explicit request for the detail, so
// it's fine to show the real driver there and let the evidence speak for
// itself via the component list underneath.
function topDriver(momentum: MomentumResult, opts?: { requireWellSupported?: boolean }): MomentumComponent | null {
  let best: MomentumComponent | null = null;
  let bestMagnitude = 0;
  for (const component of Object.values(momentum.components)) {
    if (component.score === null) continue;
    if (opts?.requireWellSupported && !component.wellSupported) continue;
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

  // Named sectionExpanded, not just "expanded" — a second, unrelated
  // "expanded" concept (which competitor ROWS are open) got added below
  // once the Map's click-through needed to force one open, and reusing the
  // same name for both was already confusing before that.
  const [sectionExpanded, setSectionExpanded] = useState(true);
  // Map defaults off, and its toggle button only renders at sm: and up
  // (see the JSX below) — a scatter plot needs real width to read, and a
  // phone-width user who somehow already had "map" selected (e.g. resized
  // down from desktop) would otherwise be stuck looking at a squeezed
  // chart with no visible way back to the list.
  const [view, setView] = useState<"list" | "map">("list");

  // Which competitor rows are expanded — lifted up from CompetitorRow's own
  // local state so a Map dot click (see handleMapSelect) can force a
  // specific row open without fighting each row's independent toggle.
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  function toggleRowExpanded(id: string) {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Scrolls to and briefly highlights a row after a Map click — see
  // handleMapSelect and the effect below. rowRefs isn't state: mutating it
  // doesn't need a re-render, only the effect that reads it after view
  // switches to "list" does.
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // A token (not just the id) so clicking the SAME dot twice in a row still
  // re-triggers the scroll — an object's identity changes every call even
  // when its id doesn't, where storing just a string wouldn't change and
  // the effect wouldn't re-fire. This also sidesteps ever needing to reset
  // the value back to null from inside the effect itself (a lint-flagged
  // pattern — setState synchronously inside an effect body).
  const [scrollTarget, setScrollTarget] = useState<{ id: string; token: number } | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (!scrollTarget || view !== "list") return;
    const el = rowRefs.current.get(scrollTarget.id);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [scrollTarget, view]);

  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => setHighlightId(null), 1800);
    return () => clearTimeout(t);
  }, [highlightId]);

  // What clicking a Map dot actually does — jumps to that competitor's row
  // right here on the dashboard (switching to List if needed, expanding
  // the row, scrolling it into view, briefly highlighting it) instead of
  // navigating to a separate page. The "Fact sheet" link inside the
  // expanded row is still there for anyone who wants the full page.
  function handleMapSelect(id: string) {
    setView("list");
    setSectionExpanded(true);
    setExpandedRowIds((prev) => new Set(prev).add(id));
    setScrollTarget({ id, token: Date.now() });
    setHighlightId(id);
  }

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

  // Feeds the inline sparkline next to each row's meter — 8 buckets of 4
  // days apiece (~32 days, roughly the two 30-day windows momentum itself
  // compares) so a row's recent shape is visible without reading any
  // numbers. Coarser than daily buckets on purpose: most competitors don't
  // produce a signal every single day, so a daily bucket count would mostly
  // be a flat line of 0s and 1s with no visible shape — 4-day buckets
  // smooth that into something that actually reads as a trend.
  const SPARKLINE_BUCKETS = 8;
  const SPARKLINE_BUCKET_DAYS = 4;
  const sparklineByCompetitor = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const c of competitors) map.set(c.id, new Array(SPARKLINE_BUCKETS).fill(0) as number[]);
    for (const s of momentumSignals) {
      const counts = map.get(s.competitor_id);
      if (!counts) continue;
      const daysAgo = Math.floor((nowMs - new Date(s.occurred_on).getTime()) / 86_400_000);
      // Bucket 0 = oldest, last bucket = most recent.
      const bucket = SPARKLINE_BUCKETS - 1 - Math.floor(daysAgo / SPARKLINE_BUCKET_DAYS);
      if (bucket >= 0 && bucket < SPARKLINE_BUCKETS) counts[bucket]++;
    }
    return map;
  }, [competitors, momentumSignals, nowMs]);

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
  const focusCompetitors = useMemo(() => {
    const quiet: FocusItem[] = sorted
      .filter((c) => goneQuietByCompetitor.get(c.id))
      .map((c) => ({ kind: "gone_quiet" as const, competitor: c, goneQuiet: goneQuietByCompetitor.get(c.id)! }));
    // Only featured when a well-supported component actually explains the
    // move — a "Heating up" label backed by nothing but a single thin
    // signal still shows as a pill in the list below, it just doesn't get
    // promoted to "the thing to look at first" without real evidence
    // behind it.
    const heating: FocusItem[] = sorted
      .filter((c) => momentumByCompetitor.get(c.id)?.label === "Heating up")
      .flatMap((c) => {
        const momentum = momentumByCompetitor.get(c.id)!;
        const driver = topDriver(momentum, { requireWellSupported: true });
        return driver ? [{ kind: "heating_up" as const, competitor: c, momentum, driver }] : [];
      });
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
        <div className="mb-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <Flame className="size-3 text-primary" />
            Focus here first
          </div>
          <div className={cn("grid gap-2", focusCompetitors.length > 1 && "sm:grid-cols-2")}>
            {focusCompetitors.map((item) => (
              <SpotlightCard key={item.competitor.id} item={item} />
            ))}
          </div>
        </div>
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
        <MomentumQuadrant competitors={quadrantCompetitors} onSelect={handleMapSelect} />
      ) : (
        <>
          {/* Expanded by default — Momentum leads the dashboard now, so the
              full per-competitor list is the point of the section rather than
              something to reveal after a click. Still collapsible for anyone
              who just wants the summary line. */}
          <button
            type="button"
            data-tour="competitor-card"
            onClick={() => setSectionExpanded((e) => !e)}
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
              {sectionExpanded ? "Collapse" : "Show all"}
              <ChevronDown className={cn("size-3.5 transition-transform", sectionExpanded && "rotate-180")} />
            </span>
          </button>

          {sectionExpanded ? (
            <div className="mt-2.5 space-y-2.5">
              {sorted.map((competitor) => (
                <CompetitorRow
                  key={competitor.id}
                  competitor={competitor}
                  momentum={momentumByCompetitor.get(competitor.id)!}
                  goneQuiet={goneQuietByCompetitor.get(competitor.id) ?? null}
                  latestSignal={latestSignalByCompetitor[competitor.id]}
                  pricingRecord={pricingByCompetitor[competitor.id]}
                  sparkline={sparklineByCompetitor.get(competitor.id) ?? []}
                  expanded={expandedRowIds.has(competitor.id)}
                  onToggleExpanded={() => toggleRowExpanded(competitor.id)}
                  highlighted={highlightId === competitor.id}
                  rowRef={(el) => {
                    if (el) rowRefs.current.set(competitor.id, el);
                    else rowRefs.current.delete(competitor.id);
                  }}
                />
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

// A fixed rose-to-emerald gradient track spanning the full -100..+100
// range with a marker at the score's position — replaces the old
// center-anchored fill bar, which at a glance looked identical across most
// of a Steady list (a thin sliver either way of dead center) and gave no
// sense of where "Heating up" or "Cooling" actually sit on the scale. The
// gradient itself is always the same regardless of score — only the marker
// moves — so the read is positional ("where on the scale is this") rather
// than needing to notice a fill bar's length. size="lg" (the Focus
// spotlight cards) adds the axis labels; size="sm" (every list row) omits
// them to stay compact, the same rose/emerald signal is legible from the
// marker position and the pill next to it alone.
// Exported so YourMomentumCard (dashboard/your-momentum-card.tsx) can reuse
// the exact same gradient meter for the account's own momentum reading —
// same visual vocabulary for "how are they doing" and "how are we doing"
// is the whole point of putting both under one Momentum umbrella.
export function MomentumMeter({
  score,
  size = "sm",
  className,
}: {
  score: number | null;
  size?: "sm" | "lg";
  className?: string;
}) {
  if (score === null) return null;
  const clamped = Math.max(-100, Math.min(100, score));
  const percent = (clamped + 100) / 2;
  const positive = clamped > 0;
  return (
    <div className={cn(size === "lg" ? "w-full" : "w-16 shrink-0", className)}>
      <div
        className={cn(
          "relative rounded-full bg-gradient-to-r from-rose-500 via-secondary to-emerald-500",
          size === "lg" ? "h-1.5" : "h-1"
        )}
        role="img"
        aria-label={`Momentum ${clamped > 0 ? "+" : ""}${clamped} out of a possible -100 to +100`}
      >
        <div
          className={cn(
            "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-background",
            size === "lg" ? "size-3" : "size-2",
            positive ? "border-emerald-500" : "border-rose-500"
          )}
          style={{ left: `${percent}%` }}
        />
      </div>
      {size === "lg" ? (
        <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
          <span>Cooling</span>
          <span>Steady</span>
          <span>Heating up</span>
        </div>
      ) : null}
    </div>
  );
}

// Tiny inline signal-volume trend, colored to match the row's own momentum
// state (emerald/rose/muted) so it reads as part of the same signal rather
// than a second, disconnected chart. Purely a shape cue — no axis, no
// hover, no labels — the numeric score and pill remain the actual reading;
// this is what lets a scan of the list feel like it has real texture
// instead of every row being a name and a pill.
function Sparkline({ counts, color }: { counts: number[]; color: "emerald" | "rose" | "muted" }) {
  if (counts.length === 0 || counts.every((c) => c === 0)) return null;
  const width = 40;
  const height = 16;
  const max = Math.max(...counts, 1);
  const step = width / (counts.length - 1);
  const points = counts.map((c, i) => `${i * step},${height - (c / max) * (height - 2) - 1}`).join(" ");
  const stroke =
    color === "emerald" ? "stroke-emerald-500" : color === "rose" ? "stroke-rose-500" : "stroke-muted-foreground/60";
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      role="img"
      aria-label="Signal activity over the last month, oldest to most recent"
    >
      <polyline points={points} fill="none" className={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Replaces the old single-paragraph "Focus here first" banner (every
// featured competitor as one more sentence in a shared box) with an actual
// card per competitor — a colored left accent, the driver's icon in a
// chip instead of plain text, and the meter at full width with its axis
// labels, so the two things worth featuring look like the most important
// thing on the section instead of reading as a denser continuation of the
// same paragraph. The reasoning sentence (built from the driving
// component's real detail/citation) is the ONLY copy here — no separate
// headline above it — since duplicating the latest-signal headline this
// card already explains in its own sentence would just repeat the same
// fact twice.
function SpotlightCard({ item }: { item: FocusItem }) {
  const isQuiet = item.kind === "gone_quiet";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-l-[3px] bg-card p-3.5",
        isQuiet ? "border-amber-500/20 border-l-amber-500 bg-amber-500/[0.03]" : "border-emerald-500/20 border-l-emerald-500 bg-emerald-500/[0.03]"
      )}
    >
      <div className="flex items-start gap-3">
        <CardAvatar seed={item.competitor.name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/app/competitors/${item.competitor.id}`} className="text-sm font-bold hover:underline">
              {item.competitor.name}
            </Link>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
                isQuiet ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              )}
            >
              {isQuiet ? <Moon className="size-2.5" /> : <DriverIcon label={item.driver.label} className="size-2.5" />}
              {isQuiet ? "Gone quiet" : item.driver.label}
            </span>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
            {isQuiet ? (
              item.goneQuiet.reason
            ) : (
              <>
                Heating up, driven by {item.driver.label.toLowerCase()}
                {item.driver.topSignal ? (
                  <>
                    :{" "}
                    {item.driver.topSignal.url ? (
                      <a
                        href={item.driver.topSignal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        &ldquo;{item.driver.topSignal.title}&rdquo;
                      </a>
                    ) : (
                      <>&ldquo;{item.driver.topSignal.title}&rdquo;</>
                    )}
                    {item.driver.topSignal.sentiment === "positive" || item.driver.topSignal.sentiment === "negative"
                      ? ` (${item.driver.topSignal.sentiment})`
                      : ""}
                    , {item.driver.detail}.
                  </>
                ) : (
                  <> ({item.driver.detail}).</>
                )}
              </>
            )}
          </p>
        </div>
        {!isQuiet ? (
          <div className="shrink-0 text-right">
            <div className={cn("text-xl leading-none font-extrabold tabular-nums", item.momentum.score! > 0 ? "text-emerald-500" : "text-rose-500")}>
              {item.momentum.score! > 0 ? "+" : ""}
              {item.momentum.score}
            </div>
          </div>
        ) : null}
      </div>
      {!isQuiet ? <MomentumMeter score={item.momentum.score} size="lg" className="mt-3" /> : null}
    </div>
  );
}

function CompetitorRow({
  competitor,
  momentum,
  goneQuiet,
  latestSignal,
  pricingRecord,
  sparkline,
  expanded,
  onToggleExpanded,
  highlighted,
  rowRef,
}: {
  competitor: Competitor;
  momentum: MomentumResult;
  goneQuiet: GoneQuietResult | null;
  latestSignal: LatestSignal | undefined;
  pricingRecord: CompetitorPricing | undefined;
  sparkline: number[];
  // Lifted to CompetitorOverview (was local state) so a Map dot click can
  // force this specific row open — see handleMapSelect.
  expanded: boolean;
  onToggleExpanded: () => void;
  // Briefly true right after a Map click lands on this row — a highlight
  // ring, not a persistent state, so "you jumped here" is visible even
  // though the row was already fully in view (scrollIntoView alone gives
  // no feedback when nothing needed to scroll).
  highlighted: boolean;
  rowRef: (el: HTMLDivElement | null) => void;
}) {
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
  const sparklineColor = displayLabel === "Heating up" ? "emerald" : displayLabel === "Cooling" ? "rose" : "muted";

  return (
    <div ref={rowRef} className={cn("rounded-xl transition-shadow", highlighted && "ring-2 ring-primary/60")}>
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

        {/* w-full so this row's own flex-wrap can actually kick in on
            mobile — without a width, a flex-wrap container just grows to
            fit its content instead of wrapping, which was pushing the
            score pill off the right edge of the screen instead of onto its
            own line once the sparkline/meter were added. sm:w-auto lets it
            go back to shrinking to content once it's sharing a row with
            the name section at that breakpoint. */}
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 sm:w-auto sm:shrink-0 sm:gap-x-4">
          <span className="text-xs text-muted-foreground">{pricingSummary(pricingRecord)}</span>
          <Sparkline counts={sparkline} color={sparklineColor} />
          <MomentumMeter score={momentum.score} />
          <div className="flex flex-col items-end gap-0.5">
            <button
              type="button"
              onClick={() => (hasMomentumData || goneQuiet) && onToggleExpanded()}
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
              <span className="flex max-w-[180px] items-center gap-1 text-right text-[10px] text-muted-foreground">
                <DriverIcon label={driver.label} className="size-2.5 shrink-0" />
                {driver.label}
              </span>
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
            <div className="space-y-1.5 text-[11px]">
              {Object.values(momentum.components).map((c) => (
                <div key={c.label} className="text-muted-foreground">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1">
                      {c.label}
                      {c.score !== null && !c.wellSupported ? (
                        <span
                          className="rounded-sm bg-amber-500/10 px-1 py-px text-[9px] font-semibold text-amber-600 dark:text-amber-400"
                          title="Based on very little data so far — an early signal, not yet a confirmed trend."
                        >
                          thin
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 tabular-nums">{c.detail}</span>
                  </div>
                  {c.topSignal ? (
                    <p className="mt-0.5 truncate text-[10.5px] italic">
                      {c.topSignal.url ? (
                        <a
                          href={c.topSignal.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          &ldquo;{c.topSignal.title}&rdquo;
                        </a>
                      ) : (
                        <>&ldquo;{c.topSignal.title}&rdquo;</>
                      )}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

        </div>
      ) : null}
    </Card>
    </div>
  );
}
