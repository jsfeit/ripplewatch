"use client";

import { useMemo } from "react";
import type { MomentumResult } from "@/lib/momentum";
import type { GoneQuietResult } from "@/lib/gone-quiet";

// Y: momentum score, -100..100, heating up at the top (SVG y grows downward,
// so this axis is inverted relative to the score). X: relevanceLevel, 0..100,
// centered at 50 rather than 0 since it isn't a signed axis the way score is.
const VIEW_W = 440;
const VIEW_H = 300;
const PAD = 34; // room for axis labels without clipping an edge dot

// A fixed 0-100 / -100..100 scale wastes almost the whole chart whenever a
// real account's competitors all happen to sit in a similar, narrow slice
// of that range (the common case — a handful of quiet, similarly-tracked
// competitors cluster near "low relevance, near-zero score"), which is
// what made the chart look like a pile of dots stuck in one corner even
// after collision resolution spread them apart locally. Instead, each axis
// zooms to the range this account's OWN competitors actually occupy (with
// padding), the same "zoom to fit" a real chart tool would do — so the
// real differences between your competitors fill the chart instead of
// being invisible against a mostly-empty 0-100 scale. MIN_SPAN keeps a
// tight real cluster (e.g. everyone within 4 points of each other) from
// getting zoomed in so far that ordinary noise reads as a dramatic spread.
const MIN_RELEVANCE_SPAN = 30;
const MIN_SCORE_SPAN = 40;

type Domain = { min: number; max: number };

function domainFor(values: number[], minSpan: number, hardMin: number, hardMax: number): Domain {
  if (values.length === 0) return { min: hardMin, max: hardMax };
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const span = Math.max(dataMax - dataMin, minSpan);
  const center = (dataMin + dataMax) / 2;
  let min = center - span / 2;
  let max = center + span / 2;
  // Shift back on-scale rather than clamping symmetrically, which would
  // silently shrink the span right when the data sits near an edge (e.g.
  // several competitors already at 0 relevance).
  if (min < hardMin) {
    max += hardMin - min;
    min = hardMin;
  }
  if (max > hardMax) {
    min -= max - hardMax;
    max = hardMax;
  }
  return { min: Math.max(hardMin, min), max: Math.min(hardMax, max) };
}

type Placed = { id: string; x: number; y: number; r: number };

// A handful of competitors clustered in the same corner (typical for
// smaller accounts — several competitors with thin, similar data all land
// near the same low-relevance/near-zero-score spot) used to render as a
// pile of overlapping circles with overlapping text labels underneath,
// unreadable regardless of chart size — the real position data was simply
// too close together to separate with more room alone. This nudges
// overlapping dots apart from their true (x, y) just enough that every
// circle is fully visible, via a small number of pairwise-separation
// passes (each pass pushes any two overlapping circles apart along the
// line between their centers). It's a qualitative "where do you roughly
// sit relative to the others" chart, not a ruler, so trading a few px of
// positional precision for every dot actually being visible and clickable
// is the right trade here.
//
// Bounds are clamped INSIDE every adjustment, not once at the very end —
// several competitors landing at nearly the identical spot near an edge
// (common: a cluster of quiet, low-relevance competitors sits right near
// the chart's left/bottom edge) used to separate correctly during the
// passes, only for a single clamp pass afterward to snap every point that
// had drifted past the boundary back to the exact same edge coordinate,
// silently recreating the overlap the whole function exists to prevent.
// Clamping as part of each step means a point pinned against an edge stays
// pinned there and the pass pushes its counterpart further away instead,
// which actually resolves the overlap.
function clamp(p: Placed) {
  p.x = Math.max(PAD, Math.min(VIEW_W - PAD, p.x));
  p.y = Math.max(PAD, Math.min(VIEW_H - PAD, p.y));
}

function resolveCollisions(points: Placed[]): Placed[] {
  const pts = points.map((p) => ({ ...p }));
  for (const p of pts) clamp(p);
  const GAP = 3;
  const MAX_PASSES = 300;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i];
        const b = pts[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = a.r + b.r + GAP;
        if (dist < minDist) {
          moved = true;
          // Perfectly (or near-) coincident points have no real direction
          // to separate along — spread them around a circle by index
          // (golden-angle-ish increments, deterministic) instead of always
          // pushing along the same axis, so a cluster pinned near a
          // corner still has SOME direction with room to move rather than
          // repeatedly trying to push past the same edge.
          let ux: number;
          let uy: number;
          if (dist > 0.01) {
            ux = dx / dist;
            uy = dy / dist;
          } else {
            const angle = (i * 7 + j * 3) * 2.399963;
            ux = Math.cos(angle);
            uy = Math.sin(angle);
          }
          const overlap = (minDist - dist) / 2;
          a.x -= ux * overlap;
          a.y -= uy * overlap;
          b.x += ux * overlap;
          b.y += uy * overlap;
          clamp(a);
          clamp(b);
        }
      }
    }
    if (!moved) break;
  }
  return pts;
}

// Dot area (not radius) scales with signal volume so the visual comparison
// is perceptually linear — a competitor with 4x the signals reads as ~4x
// the area, not 4x the radius (which would look ~16x bigger). Clamped so
// one very chatty competitor can't swallow the chart, and a floor high
// enough that a single initial letter (see below) still fits legibly
// inside even the quietest competitor's dot.
const MIN_RADIUS = 10;
const MAX_RADIUS = 22;
function radiusForCount(count: number): number {
  const area = 10 + count * 14; // base area + linear growth
  const r = Math.sqrt(area / Math.PI) * 3.2;
  return Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, r));
}

export type QuadrantCompetitor = {
  id: string;
  name: string;
  momentum: MomentumResult;
  goneQuiet: GoneQuietResult | null;
  signalCount: number;
};

// The map view of the same competitors the list already shows (see
// competitor-overview.tsx) — momentum score (heating up/cooling) against
// relevanceLevel (how relevant this competitor's signals have actually been
// scored against this account's own positioning, not a generic activity
// count — see relevanceLevel's doc comment in momentum.ts for why that's
// the more useful second axis than raw signal volume). A competitor
// missing either coordinate (not enough data yet) is listed below the
// chart instead of guessed at.
//
// Each dot shows an initial letter (same avatar language as the rest of
// the app) instead of a name printed underneath it — a name label is
// almost always wider than the dot itself, so once more than a couple of
// competitors land near each other the labels collided long before the
// circles did. Hovering a dot shows its full name/score/relevance via a
// native <title> tooltip. onSelect (not an internal router.push) lets the
// caller decide what "select a competitor" means — see
// CompetitorOverview, which jumps to that competitor's row in the List
// right here on the dashboard rather than navigating to a separate page.
export function MomentumQuadrant({
  competitors,
  onSelect,
}: {
  competitors: QuadrantCompetitor[];
  onSelect: (id: string) => void;
}) {
  const hasCoords = (c: QuadrantCompetitor) => c.momentum.score !== null && c.momentum.relevanceLevel !== null;
  const plottable = competitors.filter(hasCoords);
  // A gone-quiet competitor has ~0 signals in the recent window by
  // definition — the same reason it's flagged is the reason computeMomentum
  // usually can't produce a score for it, so it would otherwise fall
  // through to the generic "not enough data" note below and disappear
  // exactly where it matters most. Called out on its own instead of
  // guessed at with a fake position.
  const goneQuietUnplaced = competitors.filter((c) => !hasCoords(c) && c.goneQuiet);
  const unplottable = competitors.filter((c) => !hasCoords(c) && !c.goneQuiet);

  const relevanceDomain = useMemo(
    () => domainFor(plottable.map((c) => c.momentum.relevanceLevel!), MIN_RELEVANCE_SPAN, 0, 100),
    [plottable]
  );
  const scoreDomain = useMemo(
    () => domainFor(plottable.map((c) => c.momentum.score!), MIN_SCORE_SPAN, -100, 100),
    [plottable]
  );
  // Whether this render is actually zoomed in past the full 0-100/-100..100
  // range — used to caption the chart so a tightened axis doesn't get
  // silently misread as "everyone happens to sit near the far edge."
  const isZoomed = relevanceDomain.max - relevanceDomain.min < 100 || scoreDomain.max - scoreDomain.min < 200;

  function xFor(relevanceLevel: number): number {
    const span = relevanceDomain.max - relevanceDomain.min || 1;
    const t = Math.max(0, Math.min(1, (relevanceLevel - relevanceDomain.min) / span));
    return PAD + t * (VIEW_W - PAD * 2);
  }
  function yFor(score: number): number {
    const span = scoreDomain.max - scoreDomain.min || 1;
    const t = Math.max(0, Math.min(1, (score - scoreDomain.min) / span));
    return VIEW_H - PAD - t * (VIEW_H - PAD * 2);
  }

  const placed = useMemo(() => {
    const raw = plottable.map((c) => ({
      id: c.id,
      x: xFor(c.momentum.relevanceLevel!),
      y: yFor(c.momentum.score!),
      r: radiusForCount(c.signalCount),
    }));
    return new Map(resolveCollisions(raw).map((p) => [p.id, p]));
    // xFor/yFor are recreated each render but are pure functions of
    // relevanceDomain/scoreDomain (already listed below), not of anything
    // else that changes independently — listing them here would just
    // recompute every render for no behavioral difference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plottable, relevanceDomain, scoreDomain]);

  // Zero gridlines only mean something when they actually fall inside the
  // zoomed-in domain — drawing a dashed line pinned to the chart's edge
  // after zooming past the real 0/50 mark would silently misrepresent
  // where neutral actually is.
  const showScoreZeroLine = scoreDomain.min <= 0 && scoreDomain.max >= 0;
  const showRelevanceMidLine = relevanceDomain.min <= 50 && relevanceDomain.max >= 50;

  return (
    <div>
      <div className="rounded-lg border border-border bg-secondary/20 p-3">
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full" role="img" aria-label="Competitors plotted by momentum and relevance to your business">
          {showScoreZeroLine ? (
            <line x1={PAD} y1={yFor(0)} x2={VIEW_W - PAD} y2={yFor(0)} className="text-border" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" />
          ) : null}
          {showRelevanceMidLine ? (
            <line x1={xFor(50)} y1={PAD} x2={xFor(50)} y2={VIEW_H - PAD} className="text-border" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" />
          ) : null}

          <text x={PAD} y={14} className="fill-muted-foreground" fontSize="9">
            Cooling
          </text>
          <text x={VIEW_W - PAD} y={14} textAnchor="end" className="fill-muted-foreground" fontSize="9">
            Heating up
          </text>
          <text x={PAD} y={VIEW_H - 10} className="fill-muted-foreground" fontSize="9">
            Low relevance to you
          </text>
          <text x={VIEW_W - PAD} y={VIEW_H - 10} textAnchor="end" className="fill-muted-foreground" fontSize="9">
            High relevance to you
          </text>

          {plottable.map((c) => {
            const p = placed.get(c.id);
            if (!p) return null;
            const ringClass = c.goneQuiet
              ? "text-amber-500"
              : c.momentum.label === "Heating up"
                ? "text-emerald-500"
                : c.momentum.label === "Cooling"
                  ? "text-rose-500"
                  : "text-muted-foreground/50";
            return (
              <g
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(c.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(c.id)}
                className="cursor-pointer outline-none focus-visible:opacity-80"
                aria-label={`${c.name}: ${c.goneQuiet ? "Gone quiet" : c.momentum.label}, jump to this competitor in the list below`}
              >
                <title>
                  {c.name}: {c.goneQuiet ? "Gone quiet" : c.momentum.label}
                  {!c.goneQuiet && c.momentum.score !== null ? ` (${c.momentum.score! > 0 ? "+" : ""}${c.momentum.score})` : ""}
                  {c.momentum.relevanceLevel !== null ? `, relevance ${Math.round(c.momentum.relevanceLevel)}/100` : ""}
                </title>
                <circle cx={p.x} cy={p.y} r={p.r} className="fill-secondary" />
                <circle cx={p.x} cy={p.y} r={p.r} fill="none" className={ringClass} stroke="currentColor" strokeWidth={c.goneQuiet ? 2.5 : 1.5} />
                <text
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-foreground font-semibold select-none"
                  fontSize={Math.max(8, p.r * 0.8)}
                >
                  {c.name.charAt(0).toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {isZoomed && plottable.length > 0 ? (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Zoomed to how your tracked competitors compare to each other, not the full 0-100 scale.
        </p>
      ) : null}
      {goneQuietUnplaced.length > 0 ? (
        <div className="mt-2 space-y-1.5">
          {goneQuietUnplaced.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className="flex w-full items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-2 text-left text-[11px] leading-relaxed hover:border-amber-500/40"
            >
              <span className="mt-0.5 shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-amber-600 dark:text-amber-400">
                Gone quiet
              </span>
              <span className="text-foreground">
                <span className="font-medium">{c.name}</span> — too quiet to place on the map, which is the point: {c.goneQuiet!.reason}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {unplottable.length > 0 ? (
        <p className="mt-2 text-[10.5px] text-muted-foreground">
          Not enough data yet to place {unplottable.map((c) => c.name).join(", ")} on the map.
        </p>
      ) : null}
    </div>
  );
}
