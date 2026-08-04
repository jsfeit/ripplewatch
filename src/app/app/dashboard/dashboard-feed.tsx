"use client";

import { useMemo, useState } from "react";
import { Radar, Sparkles, Waves } from "lucide-react";
import { AlertCard } from "@/components/app/alert-card";
import { EmptyState } from "@/components/app/empty-state";
import { generatePreviewAlert, type PreviewInputs } from "@/lib/onboarding-preview";
import { SIGNAL_TYPE_LABELS } from "@/lib/mock-data";
import { cn, avatarColor, avatarDotColor } from "@/lib/utils";
import type { Database, SignalType } from "@/lib/supabase/types";

type Competitor = Database["public"]["Tables"]["competitors"]["Row"];
type Signal = Database["public"]["Tables"]["signals"]["Row"];

const LEVEL_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
type LevelFilter = "all" | "High" | "Medium" | "Low" | "unscored";
const LEVEL_FILTERS: LevelFilter[] = ["all", "High", "Medium", "Low", "unscored"];
const TYPE_FILTERS: Array<SignalType | "all"> = ["all", "pricing", "job_posting", "news", "funding"];

// Defaults to hiding older signals (including backfill/"Background" ones)
// so the feed reads as "what's happening now" rather than being dominated
// by whatever was seeded at signup — "All time" is one click away for
// anyone who wants the full history.
type DateFilter = "recent" | "all";
const DATE_WINDOW_DAYS = 14;
function matchesDateFilter(signal: Signal, filter: DateFilter): boolean {
  if (filter === "all") return true;
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - DATE_WINDOW_DAYS);
  return new Date(signal.occurred_on) >= cutoff;
}

function levelRank(signal: Signal): number {
  if (!signal.scored || !signal.relevance_level) return 3;
  return LEVEL_RANK[signal.relevance_level] ?? 3;
}

function matchesLevelFilter(signal: Signal, filter: LevelFilter): boolean {
  if (filter === "all") return true;
  if (filter === "unscored") return !signal.scored;
  return signal.scored && signal.relevance_level === filter;
}

// Every signal points somewhere: news/funding link to the source article
// they were detected from, pricing/job-posting signals link to the
// competitor's own page we're already watching.
function resolveUrl(signal: Signal, competitor: Competitor | undefined): string | null {
  if (signal.url) return signal.url;
  if (signal.type === "pricing") return competitor?.pricing_url ?? null;
  if (signal.type === "job_posting") return competitor?.careers_url ?? null;
  return null;
}

function weekBounds() {
  const now = new Date();
  const day = now.getUTCDay();
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
  startOfThisWeek.setUTCHours(0, 0, 0, 0);
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setUTCDate(startOfThisWeek.getUTCDate() - 7);
  return { startOfThisWeek, startOfLastWeek };
}

export function DashboardFeed({
  competitors,
  signals,
  previewContext,
  tier,
}: {
  competitors: Competitor[];
  signals: Signal[];
  previewContext: Omit<PreviewInputs, "competitorName">;
  tier: Database["public"]["Tables"]["accounts"]["Row"]["tier"];
}) {
  const [filter, setFilter] = useState<string | "all">("all");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [typeFilter, setTypeFilter] = useState<SignalType | "all">("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("recent");

  const { startOfThisWeek, startOfLastWeek } = useMemo(() => weekBounds(), []);

  const groups = useMemo(() => {
    const visibleCompetitors = competitors.filter((c) => filter === "all" || c.id === filter);
    const filteredSignals = signals.filter(
      (s) =>
        matchesLevelFilter(s, levelFilter) &&
        (typeFilter === "all" || s.type === typeFilter) &&
        matchesDateFilter(s, dateFilter)
    );

    return visibleCompetitors
      .map((competitor) => {
        const competitorSignals = filteredSignals
          .filter((s) => s.competitor_id === competitor.id)
          .sort((a, b) => {
            const rankDiff = levelRank(a) - levelRank(b);
            if (rankDiff !== 0) return rankDiff;
            // occurred_on (the article's real date), not created_at (when we
            // happened to discover it) — otherwise a backfilled months-old
            // article, just inserted, would outrank a genuinely fresh one.
            return b.occurred_on.localeCompare(a.occurred_on);
          });

        // Backfill signals are excluded here too — they were seeded once at
        // signup, not newly detected this week, so counting them would
        // overstate this week's real activity.
        const freshSignals = competitorSignals.filter((s) => s.source !== "backfill");
        const thisWeek = freshSignals.filter((s) => new Date(s.created_at) >= startOfThisWeek).length;
        const lastWeek = freshSignals.filter(
          (s) => new Date(s.created_at) >= startOfLastWeek && new Date(s.created_at) < startOfThisWeek
        ).length;

        const topRank = competitorSignals.length > 0 ? levelRank(competitorSignals[0]) : 4;

        return { competitor, signals: competitorSignals, thisWeek, lastWeek, topRank };
      })
      .filter((g) => g.signals.length > 0)
      // Highest-relevance competitor first (a group's signals are already
      // sorted High-to-Low, so its first signal's rank represents its best);
      // this-week volume only breaks ties within the same top relevance.
      .sort((a, b) => a.topRank - b.topRank || b.thisWeek - a.thisWeek || b.signals.length - a.signals.length);
  }, [competitors, signals, filter, levelFilter, typeFilter, dateFilter, startOfThisWeek, startOfLastWeek]);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All competitors" />
        {competitors.map((c) => (
          <FilterChip
            key={c.id}
            active={filter === c.id}
            onClick={() => setFilter(c.id)}
            label={c.name}
            dotColor={avatarDotColor(c.name)}
          />
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {LEVEL_FILTERS.map((level) => (
          <FilterChip
            key={level}
            active={levelFilter === level}
            onClick={() => setLevelFilter(level)}
            label={level === "all" ? "All relevance" : level === "unscored" ? "Unscored" : level}
          />
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {TYPE_FILTERS.map((type) => (
          <FilterChip
            key={type}
            active={typeFilter === type}
            onClick={() => setTypeFilter(type)}
            label={type === "all" ? "All types" : SIGNAL_TYPE_LABELS[type]}
          />
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <FilterChip
          active={dateFilter === "recent"}
          onClick={() => setDateFilter("recent")}
          label={`Last ${DATE_WINDOW_DAYS / 7} weeks`}
        />
        <FilterChip active={dateFilter === "all"} onClick={() => setDateFilter("all")} label="All time" />
      </div>

      <div className="mt-6 space-y-6">
        {groups.map(({ competitor, signals: competitorSignals, thisWeek, lastWeek }) => (
          <div key={competitor.id}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    avatarColor(competitor.name)
                  )}
                >
                  {competitor.name.charAt(0).toUpperCase()}
                </span>
                <h3 className="truncate text-sm font-semibold">{competitor.name}</h3>
              </div>
              <p className="shrink-0 text-xs text-muted-foreground">
                {thisWeek > lastWeek ? (
                  <span className="font-medium text-primary">
                    ▲ {thisWeek} signal{thisWeek === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span>
                    {thisWeek} signal{thisWeek === 1 ? "" : "s"}
                  </span>
                )}{" "}
                this week, vs {lastWeek} last week
              </p>
            </div>
            <div className="space-y-3">
              {competitorSignals.map((signal) => (
                <AlertCard
                  key={signal.id}
                  signal={{
                    type: signal.type,
                    title: signal.title,
                    summary: signal.summary,
                    scored: signal.scored,
                    relevanceLevel: signal.relevance_level,
                    relevanceReasoning: signal.relevance_reasoning,
                    url: resolveUrl(signal, competitor),
                    isBackfill: signal.source === "backfill",
                  }}
                  competitorName={competitor.name}
                  competitorInitial={competitor.name.charAt(0).toUpperCase()}
                  unscoredReason={tier === "starter" ? "tier" : "pending"}
                />
              ))}
            </div>
          </div>
        ))}

        {groups.length === 0 &&
          (competitors.length === 0 ? (
            <EmptyState
              icon={Radar}
              title="No competitors yet"
              description="Add some in Settings to start tracking signals."
            />
          ) : signals.length === 0 ? (
            <SampleAlertPreview competitorName={competitors[0].name} context={previewContext} />
          ) : (
            <EmptyState
              icon={Radar}
              title="No signals match these filters"
              description="Try a broader relevance or type filter."
            />
          ))}
      </div>
    </div>
  );
}

// Shown when an account has competitors but no real signals yet (crawling
// hasn't run for them). Reuses the same deterministic template as the
// onboarding "aha" step, against the account's actual context, so the
// dashboard doesn't feel like a cold reset from the personalized demo.
function SampleAlertPreview({
  competitorName,
  context,
}: {
  competitorName: string;
  context: Omit<PreviewInputs, "competitorName">;
}) {
  const preview = generatePreviewAlert({ ...context, competitorName });

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-lg border border-primary/25 bg-card p-4 pl-5">
        <div className="absolute inset-y-0 left-0 w-1 bg-primary" />
        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
          <Sparkles className="size-3.5" />
          Sample, based on your setup
        </div>
        <p className="mt-3 text-sm font-medium">{preview.headline}</p>
        <div className="mt-3 rounded-md border border-primary/20 bg-accent/60 p-3">
          <span className="rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
            High relevance
          </span>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{preview.reasoning}</p>
        </div>
      </div>
      <EmptyState
        icon={Waves}
        title="Real signals are on the way"
        description="Crawling runs on a schedule; this sample will be replaced by your first real alert."
      />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  dotColor,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  dotColor?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      )}
    >
      {dotColor ? <span className={cn("size-1.5 rounded-full", dotColor)} /> : null}
      {label}
    </button>
  );
}
