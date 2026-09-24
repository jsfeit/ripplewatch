"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { MomentumResult } from "@/lib/momentum";
import type { GoneQuietResult } from "@/lib/gone-quiet";

// Y: momentum score, -100..100, heating up at the top (SVG y grows downward,
// so this axis is inverted relative to the score). X: relevanceLevel, 0..100,
// centered at 50 rather than 0 since it isn't a signed axis the way score is.
const VIEW_W = 440;
const VIEW_H = 300;
const PAD = 34; // room for axis labels without clipping an edge dot
const Y_ZERO = VIEW_H / 2;
const X_MID = 50;

function xFor(relevanceLevel: number): number {
  const t = Math.max(0, Math.min(100, relevanceLevel)) / 100;
  return PAD + t * (VIEW_W - PAD * 2);
}

function yFor(score: number): number {
  const t = (Math.max(-100, Math.min(100, score)) + 100) / 200; // 0..1, 0 = cooling end
  return VIEW_H - PAD - t * (VIEW_H - PAD * 2);
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
// line between their centers, clamped back inside the chart bounds). It's
// a qualitative "where do you roughly sit relative to the others" chart,
// not a ruler, so trading a few px of positional precision for every dot
// actually being visible and clickable is the right trade here.
function resolveCollisions(points: Placed[]): Placed[] {
  const pts = points.map((p) => ({ ...p }));
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
          // Perfectly coincident points (identical score + relevance) have
          // no direction to separate along — nudge deterministically by
          // index rather than dividing by zero.
          const ux = dist > 0.01 ? dx / dist : 1;
          const uy = dist > 0.01 ? dy / dist : (i - j) * 0.01;
          const overlap = (minDist - dist) / 2;
          a.x -= ux * overlap;
          a.y -= uy * overlap;
          b.x += ux * overlap;
          b.y += uy * overlap;
        }
      }
    }
    if (!moved) break;
  }
  for (const p of pts) {
    p.x = Math.max(PAD, Math.min(VIEW_W - PAD, p.x));
    p.y = Math.max(PAD, Math.min(VIEW_H - PAD, p.y));
  }
  return pts;
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
// native <title> tooltip; tapping still jumps straight to the competitor
// page either way.
export function MomentumQuadrant({ competitors }: { competitors: QuadrantCompetitor[] }) {
  const router = useRouter();

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

  const placed = useMemo(() => {
    const raw = plottable.map((c) => ({
      id: c.id,
      x: xFor(c.momentum.relevanceLevel!),
      y: yFor(c.momentum.score!),
      r: radiusForCount(c.signalCount),
    }));
    const resolved = resolveCollisions(raw);
    return new Map(resolved.map((p) => [p.id, p]));
  }, [plottable]);

  function go(id: string) {
    router.push(`/app/competitors/${id}`);
  }

  return (
    <div>
      <div className="rounded-lg border border-border bg-secondary/20 p-3">
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full" role="img" aria-label="Competitors plotted by momentum and relevance to your business">
          <line x1={PAD} y1={Y_ZERO} x2={VIEW_W - PAD} y2={Y_ZERO} className="text-border" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" />
          <line x1={xFor(X_MID)} y1={PAD} x2={xFor(X_MID)} y2={VIEW_H - PAD} className="text-border" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" />

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
                onClick={() => go(c.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && go(c.id)}
                className="cursor-pointer outline-none focus-visible:opacity-80"
                aria-label={`${c.name}: ${c.goneQuiet ? "Gone quiet" : c.momentum.label}, open competitor page`}
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
      {goneQuietUnplaced.length > 0 ? (
        <div className="mt-2 space-y-1.5">
          {goneQuietUnplaced.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => go(c.id)}
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
