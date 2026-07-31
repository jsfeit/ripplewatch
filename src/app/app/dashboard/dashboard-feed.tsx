"use client";

import { useMemo, useState } from "react";
import { Radar, Sparkles, Waves } from "lucide-react";
import { AlertCard } from "@/components/app/alert-card";
import { EmptyState } from "@/components/app/empty-state";
import { generatePreviewAlert, type PreviewInputs } from "@/lib/onboarding-preview";
import { cn, avatarColor, avatarDotColor } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type Competitor = Database["public"]["Tables"]["competitors"]["Row"];
type Signal = Database["public"]["Tables"]["signals"]["Row"];

const LEVEL_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

function levelRank(signal: Signal): number {
  if (!signal.scored || !signal.relevance_level) return 3;
  return LEVEL_RANK[signal.relevance_level] ?? 3;
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
}: {
  competitors: Competitor[];
  signals: Signal[];
  previewContext: Omit<PreviewInputs, "competitorName">;
}) {
  const [filter, setFilter] = useState<string | "all">("all");

  const { startOfThisWeek, startOfLastWeek } = useMemo(() => weekBounds(), []);

  const groups = useMemo(() => {
    const visibleCompetitors = competitors.filter((c) => filter === "all" || c.id === filter);

    return visibleCompetitors
      .map((competitor) => {
        const competitorSignals = signals
          .filter((s) => s.competitor_id === competitor.id)
          .sort((a, b) => {
            const rankDiff = levelRank(a) - levelRank(b);
            if (rankDiff !== 0) return rankDiff;
            return b.created_at.localeCompare(a.created_at);
          });

        const thisWeek = competitorSignals.filter((s) => new Date(s.created_at) >= startOfThisWeek).length;
        const lastWeek = competitorSignals.filter(
          (s) => new Date(s.created_at) >= startOfLastWeek && new Date(s.created_at) < startOfThisWeek
        ).length;

        return { competitor, signals: competitorSignals, thisWeek, lastWeek };
      })
      .filter((g) => g.signals.length > 0)
      .sort((a, b) => b.thisWeek - a.thisWeek || b.signals.length - a.signals.length);
  }, [competitors, signals, filter, startOfThisWeek, startOfLastWeek]);

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

      <div className="mt-6 space-y-6">
        {groups.map(({ competitor, signals: competitorSignals, thisWeek, lastWeek }) => (
          <div key={competitor.id}>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[11px] font-semibold",
                    avatarColor(competitor.name)
                  )}
                >
                  {competitor.name.charAt(0).toUpperCase()}
                </span>
                <h3 className="text-sm font-semibold">{competitor.name}</h3>
              </div>
              <p className="text-xs text-muted-foreground">
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
                  }}
                  competitorName={competitor.name}
                  competitorInitial={competitor.name.charAt(0).toUpperCase()}
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
          ) : (
            <SampleAlertPreview competitorName={competitors[0].name} context={previewContext} />
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
