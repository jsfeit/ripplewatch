"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, HelpCircle } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { cn, avatarColor } from "@/lib/utils";
import type { Database, SeoTrafficTrend } from "@/lib/supabase/types";

type Competitor = Database["public"]["Tables"]["competitors"]["Row"];
type CompetitorSeo = Database["public"]["Tables"]["competitor_seo"]["Row"];
type Signal = Database["public"]["Tables"]["signals"]["Row"];

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
  seo,
  seoSignals,
}: {
  competitors: Competitor[];
  seo: CompetitorSeo[];
  seoSignals: Signal[];
}) {
  const seoByCompetitor = useMemo(() => new Map(seo.map((s) => [s.competitor_id, s])), [seo]);
  const latestSignalByCompetitor = useMemo(() => {
    const map = new Map<string, Signal>();
    for (const signal of seoSignals) {
      if (!map.has(signal.competitor_id)) map.set(signal.competitor_id, signal);
    }
    return map;
  }, [seoSignals]);

  const sorted = useMemo(
    () =>
      [...competitors].sort((a, b) => {
        const trafficA = seoByCompetitor.get(a.id)?.organic_traffic_estimate ?? -1;
        const trafficB = seoByCompetitor.get(b.id)?.organic_traffic_estimate ?? -1;
        if (trafficA === trafficB) return a.name.localeCompare(b.name);
        return trafficB - trafficA;
      }),
    [competitors, seoByCompetitor]
  );

  if (competitors.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No competitors yet"
        description="Add some in Competitors to start tracking their estimated traffic."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((competitor) => (
        <KeyMetricCard
          key={competitor.id}
          competitor={competitor}
          record={seoByCompetitor.get(competitor.id)}
          changedAt={latestSignalByCompetitor.get(competitor.id)?.created_at}
        />
      ))}
    </div>
  );
}

function KeyMetricCard({
  competitor,
  record,
  changedAt,
}: {
  competitor: Competitor;
  record: CompetitorSeo | undefined;
  changedAt: string | undefined;
}) {
  const TrendIcon = record ? TREND_ICONS[record.traffic_trend ?? "unknown"] : HelpCircle;

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
        {changedAt ? (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            Changed {timeAgo(changedAt)}
          </span>
        ) : null}
      </div>

      {!record ? (
        <p className="mt-3 text-xs text-muted-foreground">Not checked yet; runs on the next scheduled crawl.</p>
      ) : (
        <>
          <div className="mt-3 flex items-baseline gap-2">
            <p className="text-2xl font-bold tabular-nums">
              {record.organic_traffic_estimate !== null ? record.organic_traffic_estimate.toLocaleString() : "—"}
            </p>
            <span className="text-[11px] text-muted-foreground">est. monthly visits</span>
          </div>
          <span
            className={cn(
              "mt-2.5 inline-flex w-fit items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold",
              TREND_STYLES[record.traffic_trend ?? "unknown"]
            )}
          >
            <TrendIcon className="size-3" />
            {TREND_LABELS[record.traffic_trend ?? "unknown"]}
          </span>

          {record.top_keywords.length > 0 ? (
            <ul className="mt-3 space-y-0.5 text-xs text-muted-foreground">
              {record.top_keywords.slice(0, 3).map((kw, i) => (
                <li key={i} className="before:mr-1 before:text-primary before:content-['‣']">
                  {kw}
                </li>
              ))}
            </ul>
          ) : null}

          <p className="mt-2.5 border-t border-dashed border-border pt-2.5 text-[10.5px] text-muted-foreground">
            Last checked {timeAgo(record.last_checked_at)}
          </p>
        </>
      )}
    </div>
  );
}
