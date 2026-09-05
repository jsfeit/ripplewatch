"use client";

import { useMemo, useState } from "react";
import { Radar, Sparkles, Waves } from "lucide-react";
import { AlertCard } from "@/components/app/alert-card";
import { EmptyState } from "@/components/app/empty-state";
import { generatePreviewAlert, type PreviewInputs } from "@/lib/onboarding-preview";
import { SIGNAL_TYPE_LABELS } from "@/lib/mock-data";
import { cn, avatarDotColor } from "@/lib/utils";
import { RECENCY_WINDOW_DAYS, isOldSignal } from "@/lib/signal-freshness";
import type { Database, SignalType } from "@/lib/supabase/types";

type Competitor = Pick<Database["public"]["Tables"]["competitors"]["Row"], "id" | "name" | "pricing_url" | "careers_url">;
type Signal = Pick<
  Database["public"]["Tables"]["signals"]["Row"],
  | "id"
  | "competitor_id"
  | "type"
  | "title"
  | "summary"
  | "scored"
  | "relevance_level"
  | "relevance_score"
  | "relevance_reasoning"
  | "url"
  | "occurred_on"
>;

type LevelFilter = "all" | "High" | "Medium" | "Low" | "unscored";
const LEVEL_FILTERS: LevelFilter[] = ["all", "High", "Medium", "Low", "unscored"];
const TYPE_FILTERS: Array<SignalType | "all"> = ["all", "pricing", "job_posting", "news", "funding", "product_change"];

// Defaults to hiding older signals (including "Background"-badged ones) so
// the feed reads as "what's happening now" rather than being dominated by
// old context — "All time" is one click away for anyone who wants the full
// history. Same RECENCY_WINDOW_DAYS threshold AlertCard uses for the
// "Background" badge, so what's hidden by default and what's badged when
// shown stay in sync.
type DateFilter = "recent" | "all";

// Caps the feed so News doesn't bury Pricing/Trends/Win-loss below it on
// the merged dashboard — "Show all" is one click away, same pattern as the
// date filter's "All time".
const COLLAPSED_COUNT = 3;
function matchesDateFilter(signal: Signal, filter: DateFilter): boolean {
  if (filter === "all") return true;
  return !isOldSignal(signal.occurred_on);
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

export function DashboardFeed({
  competitors,
  signals,
  previewContext,
  evalLabelBySignalId,
}: {
  competitors: Competitor[];
  signals: Signal[];
  previewContext: Omit<PreviewInputs, "competitorName">;
  evalLabelBySignalId: Record<string, "correct" | "incorrect">;
}) {
  const [filter, setFilter] = useState<string | "all">("all");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [typeFilter, setTypeFilter] = useState<SignalType | "all">("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("recent");
  const [showAll, setShowAll] = useState(false);

  // One flat feed sorted by score, not grouped by competitor — the highest-
  // relevance signal across every tracked competitor leads regardless of
  // which company it's about. Unscored signals sort to the bottom (no score
  // to rank by); occurred_on is the tiebreaker for equal/missing scores so
  // freshest still wins ties, same as before.
  const rows = useMemo(() => {
    const competitorById = new Map(competitors.map((c) => [c.id, c]));
    return signals
      .filter(
        (s) =>
          (filter === "all" || s.competitor_id === filter) &&
          matchesLevelFilter(s, levelFilter) &&
          (typeFilter === "all" || s.type === typeFilter) &&
          matchesDateFilter(s, dateFilter)
      )
      .map((signal) => ({ signal, competitor: competitorById.get(signal.competitor_id) }))
      .filter((r): r is { signal: Signal; competitor: Competitor } => Boolean(r.competitor))
      .sort((a, b) => {
        const scoreDiff = (b.signal.relevance_score ?? -1) - (a.signal.relevance_score ?? -1);
        if (scoreDiff !== 0) return scoreDiff;
        return b.signal.occurred_on.localeCompare(a.signal.occurred_on);
      });
  }, [competitors, signals, filter, levelFilter, typeFilter, dateFilter]);

  const visibleRows = showAll ? rows : rows.slice(0, COLLAPSED_COUNT);

  return (
    <div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Competitor</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
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
      </div>

      <div className="mt-3 flex flex-wrap items-start gap-x-4 gap-y-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Relevance</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {LEVEL_FILTERS.map((level) => (
              <FilterChip
                key={level}
                active={levelFilter === level}
                onClick={() => setLevelFilter(level)}
                label={level === "all" ? "All relevance" : level === "unscored" ? "Unscored" : level}
              />
            ))}
          </div>
        </div>
        <div className="h-8 w-px self-center bg-border" />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Category</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {TYPE_FILTERS.map((type) => (
              <FilterChip
                key={type}
                active={typeFilter === type}
                onClick={() => setTypeFilter(type)}
                label={type === "all" ? "All types" : SIGNAL_TYPE_LABELS[type]}
              />
            ))}
          </div>
        </div>
        <div className="h-8 w-px self-center bg-border" />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Timing</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <FilterChip
              active={dateFilter === "recent"}
              onClick={() => setDateFilter("recent")}
              label={`Last ${RECENCY_WINDOW_DAYS / 7} weeks`}
            />
            <FilterChip active={dateFilter === "all"} onClick={() => setDateFilter("all")} label="All time" />
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {rows.length} signal{rows.length === 1 ? "" : "s"}, highest relevance first
        {!showAll && rows.length > COLLAPSED_COUNT ? ` (showing top ${COLLAPSED_COUNT})` : ""}
      </p>

      <div className="mt-2 space-y-3">
        {visibleRows.map(({ signal, competitor }) => (
          <AlertCard
            key={signal.id}
            signal={{
              id: signal.id,
              type: signal.type,
              title: signal.title,
              summary: signal.summary,
              scored: signal.scored,
              relevanceLevel: signal.relevance_level,
              relevanceScore: signal.relevance_score,
              relevanceReasoning: signal.relevance_reasoning,
              url: resolveUrl(signal, competitor),
              isBackground: isOldSignal(signal.occurred_on),
              evalLabel: evalLabelBySignalId[signal.id] ?? null,
            }}
            competitorName={competitor.name}
            competitorInitial={competitor.name.charAt(0).toUpperCase()}
          />
        ))}

        {rows.length === 0 &&
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

      {!showAll && rows.length > COLLAPSED_COUNT ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 text-xs font-medium text-primary hover:underline"
        >
          Show all {rows.length} signals
        </button>
      ) : null}
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
        <div data-tour="relevance-badge" className="mt-3 rounded-md border border-primary/20 bg-accent/60 p-3">
          <span className="rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
            High relevance
          </span>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{preview.reasoning}</p>
        </div>
      </div>
      <EmptyState
        icon={Waves}
        title="We're scanning your competitors now"
        description="First alerts typically show up within a few minutes and will replace this sample. After that, we're always watching, so you won't need to wait like this again."
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
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
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
