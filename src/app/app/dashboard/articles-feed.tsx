"use client";

import { useMemo } from "react";
import { Newspaper } from "lucide-react";
import { ArticleRow } from "@/components/app/article-row";
import { EmptyState } from "@/components/app/empty-state";
import type { Database } from "@/lib/supabase/types";

type Competitor = Database["public"]["Tables"]["competitors"]["Row"];
type Signal = Database["public"]["Tables"]["signals"]["Row"];

const LEVEL_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

function levelRank(signal: Signal): number {
  if (!signal.scored || !signal.relevance_level) return 3;
  return LEVEL_RANK[signal.relevance_level] ?? 3;
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

export function ArticlesFeed({ competitors, signals }: { competitors: Competitor[]; signals: Signal[] }) {
  const rows = useMemo(
    () =>
      [...signals].sort((a, b) => {
        const rankDiff = levelRank(a) - levelRank(b);
        if (rankDiff !== 0) return rankDiff;
        return b.created_at.localeCompare(a.created_at);
      }),
    [signals]
  );

  return (
    <div className="space-y-3">
      {rows.map((signal) => {
        const competitor = competitors.find((c) => c.id === signal.competitor_id);
        if (!competitor) return null;
        return (
          <ArticleRow
            key={signal.id}
            signal={{
              type: signal.type,
              title: signal.title,
              url: resolveUrl(signal, competitor),
              scored: signal.scored,
              relevanceLevel: signal.relevance_level,
              relevanceReasoning: signal.relevance_reasoning,
            }}
            competitorName={competitor.name}
            competitorInitial={competitor.name.charAt(0).toUpperCase()}
          />
        );
      })}
      {rows.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="No signals yet"
          description="Every signal will show up here, ranked by relevance, with a link back to its source."
        />
      ) : null}
    </div>
  );
}
