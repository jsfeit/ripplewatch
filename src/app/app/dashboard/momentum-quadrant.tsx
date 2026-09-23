"use client";

import { useRouter } from "next/navigation";
import type { MomentumResult } from "@/lib/momentum";
import type { GoneQuietResult } from "@/lib/gone-quiet";

// Y: momentum score, -100..100, heating up at the top (SVG y grows downward,
// so this axis is inverted relative to the score). X: relevanceLevel, 0..100,
// centered at 50 rather than 0 since it isn't a signed axis the way score is.
const VIEW_W = 400;
const VIEW_H = 260;
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
// one very chatty competitor can't swallow the chart, and a floor so a
// quiet competitor's dot never disappears entirely.
const MIN_RADIUS = 7;
const MAX_RADIUS = 20;
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
            const cx = xFor(c.momentum.relevanceLevel!);
            const cy = yFor(c.momentum.score!);
            const r = radiusForCount(c.signalCount);
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
                <circle cx={cx} cy={cy} r={r} className="fill-secondary" />
                <circle cx={cx} cy={cy} r={r} fill="none" className={ringClass} stroke="currentColor" strokeWidth={c.goneQuiet ? 2.5 : 1.5} />
                <text x={cx} y={cy + r + 11} textAnchor="middle" className="fill-muted-foreground" fontSize="9.5">
                  {c.name.length > 14 ? `${c.name.slice(0, 13)}…` : c.name}
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
