"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, HelpCircle, ChevronDown, ArrowUpRight } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { Card, CardAvatar, CardChangedBadge } from "@/components/app/card";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/date";
import { computeMomentum, MOMENTUM_STYLES, type MomentumResult } from "@/lib/momentum";
import type { Database, SeoTrafficTrend } from "@/lib/supabase/types";

type Competitor = Pick<Database["public"]["Tables"]["competitors"]["Row"], "id" | "name">;
type CompetitorSeo = Pick<
  Database["public"]["Tables"]["competitor_seo"]["Row"],
  "competitor_id" | "traffic_trend" | "organic_traffic_estimate" | "last_checked_at"
>;
type CompetitorPricing = Pick<Database["public"]["Tables"]["competitor_pricing"]["Row"], "tiers">;
type SignalRow = Database["public"]["Tables"]["signals"]["Row"];
type MomentumSignal = Pick<SignalRow, "competitor_id" | "type" | "occurred_on" | "scored" | "relevance_score">;
// seoSignals is only ever read for .competitor_id/.created_at (see
// latestSeoSignalByCompetitor below); latestSignalByCompetitor is only
// ever read for .title (see the CompetitorRow it's passed into) — two
// different narrow shapes, not the same Signal type reused.
type SeoSignal = Pick<SignalRow, "competitor_id" | "created_at">;
type LatestSignal = Pick<SignalRow, "title">;

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

function pricingSummary(record: CompetitorPricing | undefined): string {
  if (!record) return "Pricing not checked yet";
  const numericTiers = record.tiers.filter((t): t is typeof t & { price: number } => t.price !== null);
  if (numericTiers.length === 0) return "No public pricing";
  const cheapest = numericTiers.reduce((min, t) => (t.price < min.price ? t : min));
  return `From $${cheapest.price}${cheapest.price_period ? `/${cheapest.price_period}` : ""}`;
}

// Everything that used to be scattered across the Trends momentum cards
// (hiring/pricing/press/relevance breakdown, SEO traffic) plus what
// previously required visiting News and Competitor Pricing separately
// (latest signal, price point) for a read on one specific competitor —
// one row per competitor, expandable for the detail. Replaces
// MomentumBoard as the dashboard's momentum surface; the old card grid is
// gone, not duplicated.
export function CompetitorOverview({
  competitors,
  momentumSignals,
  seoAllowed,
  seo,
  seoSignals,
  latestSignalByCompetitor,
  pricingByCompetitor,
}: {
  competitors: Competitor[];
  momentumSignals: MomentumSignal[];
  seoAllowed: boolean;
  seo: CompetitorSeo[];
  seoSignals: SeoSignal[];
  latestSignalByCompetitor: Record<string, LatestSignal>;
  pricingByCompetitor: Record<string, CompetitorPricing>;
}) {
  const seoByCompetitor = useMemo(() => new Map(seo.map((s) => [s.competitor_id, s])), [seo]);
  const latestSeoSignalByCompetitor = useMemo(() => {
    const map = new Map<string, SeoSignal>();
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

  const [expanded, setExpanded] = useState(false);

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
      {/* Collapsed by default so Trends (right below) doesn't have to
          compete with a full per-competitor list for the first screenful —
          the summary line still surfaces the one thing worth knowing at a
          glance (who's moving) without requiring a click. */}
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
              seoAllowed={seoAllowed}
              seoRecord={seoByCompetitor.get(competitor.id)}
              seoChangedAt={latestSeoSignalByCompetitor.get(competitor.id)?.created_at}
              latestSignal={latestSignalByCompetitor[competitor.id]}
              pricingRecord={pricingByCompetitor[competitor.id]}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CompetitorRow({
  competitor,
  momentum,
  seoAllowed,
  seoRecord,
  seoChangedAt,
  latestSignal,
  pricingRecord,
}: {
  competitor: Competitor;
  momentum: MomentumResult;
  seoAllowed: boolean;
  seoRecord: CompetitorSeo | undefined;
  seoChangedAt: string | undefined;
  latestSignal: LatestSignal | undefined;
  pricingRecord: CompetitorPricing | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const TrendIcon = seoRecord ? TREND_ICONS[seoRecord.traffic_trend ?? "unknown"] : HelpCircle;
  const hasMomentumData = momentum.score !== null;
  const hasDetail = hasMomentumData || seoAllowed;

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
          <button
            type="button"
            onClick={() => hasDetail && setExpanded((e) => !e)}
            disabled={!hasDetail}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1",
              MOMENTUM_STYLES[momentum.label],
              hasDetail && "cursor-pointer"
            )}
          >
            {hasMomentumData ? (
              <span className="text-xs font-bold tabular-nums">
                {momentum.score! > 0 ? "+" : ""}
                {momentum.score}
              </span>
            ) : null}
            <span className="text-xs font-semibold whitespace-nowrap">{momentum.label}</span>
            {hasDetail ? (
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

          {seoAllowed ? (
            <div className={hasMomentumData ? "mt-3 border-t border-dashed border-border pt-3" : ""}>
              {!seoRecord ? (
                <p className="text-xs text-muted-foreground">Traffic not checked yet; runs on the next scheduled crawl.</p>
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <p className="text-lg font-bold tabular-nums">
                      {seoRecord.organic_traffic_estimate !== null
                        ? seoRecord.organic_traffic_estimate.toLocaleString()
                        : "—"}
                    </p>
                    <span className="text-[11px] text-muted-foreground">est. monthly visits</span>
                    {seoChangedAt ? (
                      <span className="ml-auto shrink-0">
                        <CardChangedBadge>Changed {timeAgo(seoChangedAt)}</CardChangedBadge>
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
                  <p className="mt-2 text-[10.5px] text-muted-foreground">Last checked {timeAgo(seoRecord.last_checked_at)}</p>
                </>
              )}
            </div>
          ) : (
            <p className={cn("text-[10.5px] text-muted-foreground", hasMomentumData && "mt-3 border-t border-dashed border-border pt-3")}>
              <Link href="/app/settings?tab=plan" className="text-primary hover:underline">
                Upgrade to Plus
              </Link>{" "}
              to see estimated organic traffic.
            </p>
          )}
        </div>
      ) : null}
    </Card>
  );
}
