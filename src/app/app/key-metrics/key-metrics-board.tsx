"use client";

import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Minus, HelpCircle, ChevronDown } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { cn, avatarColor } from "@/lib/utils";
import { computeMomentum, type MomentumResult } from "@/lib/momentum";
import type { Database, SeoTrafficTrend } from "@/lib/supabase/types";

type Competitor = Database["public"]["Tables"]["competitors"]["Row"];
type CompetitorSeo = Database["public"]["Tables"]["competitor_seo"]["Row"];
type Signal = Database["public"]["Tables"]["signals"]["Row"];
type MomentumSignal = Pick<Signal, "competitor_id" | "type" | "occurred_on" | "scored" | "relevance_score">;

const TREND_LABELS: Record<SeoTrafficTrend, string> = {
  up: "Trending up",
  down: "Trending down",
  flat: "Flat",
  unknown: "Unknown",
};

const TREND_ICONS: Record<SeoTrafficTrend, typeof TrendingUp> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
  unknown: HelpCircle,
};

const TREND_STYLES: Record<SeoTrafficTrend, string> = {
  up: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  down: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  flat: "bg-secondary text-muted-foreground",
  unknown: "bg-secondary text-muted-foreground",
};

const MOMENTUM_STYLES: Record<MomentumResult["label"], string> = {
  "Heating up": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Steady: "bg-secondary text-muted-foreground",
  Cooling: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  "Not enough history yet": "bg-secondary text-muted-foreground",
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export function KeyMetricsBoard({
  competitors,
  momentumSignals,
  seoAllowed,
  seo,
  seoSignals,
}: {
  competitors: Competitor[];
  momentumSignals: MomentumSignal[];
  seoAllowed: boolean;
  seo: CompetitorSeo[];
  seoSignals: Signal[];
}) {
  const seoByCompetitor = useMemo(() => new Map(seo.map((s) => [s.competitor_id, s])), [seo]);
  const latestSeoSignalByCompetitor = useMemo(() => {
    const map = new Map<string, Signal>();
    for (const signal of seoSignals) {
      if (!map.has(signal.competitor_id)) map.set(signal.competitor_id, signal);
    }
    return map;
  }, [seoSignals]);

  const momentumByCompetitor = useMemo(() => {
    const byCompetitor = new Map<string, MomentumSignal[]>();
    for (const signal of momentumSignals) {
      const list = byCompetitor.get(signal.competitor_id) ?? [];
      list.push(signal);
      byCompetitor.set(signal.competitor_id, list);
    }
    return new Map(competitors.map((c) => [c.id, computeMomentum(byCompetitor.get(c.id) ?? [])]));
  }, [competitors, momentumSignals]);

  // Highest momentum leads — that's the headline takeaway of this page now,
  // traffic estimate is secondary. Competitors with no history yet sort
  // last rather than randomly interleaving with real scores.
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

  if (competitors.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No competitors yet"
        description="Add some in Competitors to start tracking momentum."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((competitor) => (
        <KeyMetricCard
          key={competitor.id}
          competitor={competitor}
          momentum={momentumByCompetitor.get(competitor.id)!}
          seoAllowed={seoAllowed}
          seoRecord={seoByCompetitor.get(competitor.id)}
          seoChangedAt={latestSeoSignalByCompetitor.get(competitor.id)?.created_at}
        />
      ))}
    </div>
  );
}

function KeyMetricCard({
  competitor,
  momentum,
  seoAllowed,
  seoRecord,
  seoChangedAt,
}: {
  competitor: Competitor;
  momentum: MomentumResult;
  seoAllowed: boolean;
  seoRecord: CompetitorSeo | undefined;
  seoChangedAt: string | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const TrendIcon = seoRecord ? TREND_ICONS[seoRecord.traffic_trend ?? "unknown"] : HelpCircle;
  const hasMomentumData = momentum.score !== null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            avatarColor(competitor.name)
          )}
        >
          {competitor.name.charAt(0).toUpperCase()}
        </span>
        <p className="flex-1 truncate text-sm font-semibold">{competitor.name}</p>
      </div>

      <button
        type="button"
        onClick={() => hasMomentumData && setExpanded((e) => !e)}
        disabled={!hasMomentumData}
        className={cn(
          "mt-3 flex w-full items-center justify-between rounded-lg px-2.5 py-2",
          MOMENTUM_STYLES[momentum.label],
          hasMomentumData && "cursor-pointer"
        )}
      >
        <span className="flex items-baseline gap-1.5">
          {hasMomentumData ? (
            <span className="text-lg font-bold tabular-nums">
              {momentum.score! > 0 ? "+" : ""}
              {momentum.score}
            </span>
          ) : null}
          <span className="text-xs font-semibold">{momentum.label}</span>
        </span>
        {hasMomentumData ? (
          <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
        ) : null}
      </button>

      {expanded && hasMomentumData ? (
        <div className="mt-2 space-y-1 border-b border-dashed border-border pb-3 text-[11px]">
          {Object.values(momentum.components).map((c) => (
            <div key={c.label} className="flex items-center justify-between text-muted-foreground">
              <span>{c.label}</span>
              <span className="tabular-nums">
                {c.score === null ? "no data" : `${c.recentCount} vs ${c.priorCount} last period`}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {seoAllowed ? (
        !seoRecord ? (
          <p className="mt-3 text-xs text-muted-foreground">Traffic not checked yet; runs on the next scheduled crawl.</p>
        ) : (
          <>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="text-xl font-bold tabular-nums">
                {seoRecord.organic_traffic_estimate !== null
                  ? seoRecord.organic_traffic_estimate.toLocaleString()
                  : "—"}
              </p>
              <span className="text-[11px] text-muted-foreground">est. monthly visits</span>
              {seoChangedAt ? (
                <span className="ml-auto shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Changed {timeAgo(seoChangedAt)}
                </span>
              ) : null}
            </div>
            <span
              className={cn(
                "mt-2 inline-flex w-fit items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold",
                TREND_STYLES[seoRecord.traffic_trend ?? "unknown"]
              )}
            >
              <TrendIcon className="size-3" />
              {TREND_LABELS[seoRecord.traffic_trend ?? "unknown"]}
            </span>
            {seoRecord.top_keywords.length > 0 ? (
              <ul className="mt-2.5 space-y-0.5 text-xs text-muted-foreground">
                {seoRecord.top_keywords.slice(0, 3).map((kw, i) => (
                  <li key={i} className="before:mr-1 before:text-primary before:content-['‣']">
                    {kw}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-2.5 border-t border-dashed border-border pt-2.5 text-[10.5px] text-muted-foreground">
              Last checked {timeAgo(seoRecord.last_checked_at)}
            </p>
          </>
        )
      ) : (
        <p className="mt-3 text-[10.5px] text-muted-foreground">
          <a href="/app/settings" className="text-primary hover:underline">
            Upgrade to Plus
          </a>{" "}
          to see estimated organic traffic.
        </p>
      )}
    </div>
  );
}
