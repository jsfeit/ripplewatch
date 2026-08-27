"use client";

import { useMemo } from "react";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { Card, CardAvatar, CardChangedBadge, CardFoot, CardHead } from "@/components/app/card";
import { timeAgo } from "@/lib/date";
import type { Database } from "@/lib/supabase/types";

type Competitor = Pick<Database["public"]["Tables"]["competitors"]["Row"], "id" | "name" | "careers_url">;
type CompetitorHiring = Pick<
  Database["public"]["Tables"]["competitor_hiring"]["Row"],
  "competitor_id" | "open_role_count" | "department_breakdown" | "source" | "last_checked_at"
>;
type Signal = Pick<Database["public"]["Tables"]["signals"]["Row"], "competitor_id" | "created_at">;

// Real ATS name, not the internal provider key — surfaced as a small
// provenance label so it's clear which competitors get the structured API
// read (real department field) versus the generic HTML-scrape fallback
// (department is a keyword guess). Unlisted/null source means the latter.
const ATS_LABELS: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  workable: "Workable",
  smartrecruiters: "SmartRecruiters",
};

export function HiringBoard({
  competitors,
  hiring,
  hiringSignals,
}: {
  competitors: Competitor[];
  hiring: CompetitorHiring[];
  hiringSignals: Signal[];
}) {
  const hiringByCompetitor = useMemo(() => new Map(hiring.map((h) => [h.competitor_id, h])), [hiring]);
  const latestSignalByCompetitor = useMemo(() => {
    const map = new Map<string, Signal>();
    for (const signal of hiringSignals) {
      if (!map.has(signal.competitor_id)) map.set(signal.competitor_id, signal);
    }
    return map;
  }, [hiringSignals]);

  const sorted = useMemo(
    () =>
      [...competitors].sort((a, b) => {
        const countA = hiringByCompetitor.get(a.id)?.open_role_count;
        const countB = hiringByCompetitor.get(b.id)?.open_role_count;
        if (countA === undefined) return countB === undefined ? a.name.localeCompare(b.name) : 1;
        if (countB === undefined) return -1;
        return countB - countA;
      }),
    [competitors, hiringByCompetitor]
  );

  if (competitors.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No competitors yet"
        description="Add some in Competitors to start tracking their hiring."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((competitor) => (
        <HiringCard
          key={competitor.id}
          competitor={competitor}
          record={hiringByCompetitor.get(competitor.id)}
          changedAt={latestSignalByCompetitor.get(competitor.id)?.created_at}
        />
      ))}
    </div>
  );
}

function HiringCard({
  competitor,
  record,
  changedAt,
}: {
  competitor: Competitor;
  record: CompetitorHiring | undefined;
  changedAt: string | undefined;
}) {
  const departments = record
    ? Object.entries(record.department_breakdown).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <Card>
      <CardHead
        avatar={<CardAvatar seed={competitor.name} />}
        title={competitor.name}
        meta={changedAt ? <CardChangedBadge>New roles {timeAgo(changedAt)}</CardChangedBadge> : null}
      />

      {!record && !competitor.careers_url ? (
        <p className="text-xs text-muted-foreground">No careers page URL set for this competitor yet.</p>
      ) : !record ? (
        <p className="text-xs text-muted-foreground">Not checked yet; runs on the next scheduled crawl.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl font-bold tabular-nums">{record.open_role_count}</p>
            <span className="text-xs text-muted-foreground">
              open role{record.open_role_count === 1 ? "" : "s"}
            </span>
          </div>

          {departments.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {departments.map(([department, count]) => (
                <span
                  key={department}
                  className="rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  {department} <span className="font-semibold text-foreground">{count}</span>
                </span>
              ))}
            </div>
          ) : null}

          <CardFoot>
            <span>
              Last checked {timeAgo(record.last_checked_at)}
              {record.source && ATS_LABELS[record.source] ? ` · via ${ATS_LABELS[record.source]}` : ""}
            </span>
            {competitor.careers_url ? (
              <a
                href={competitor.careers_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                View careers page
              </a>
            ) : null}
          </CardFoot>
        </>
      )}
    </Card>
  );
}
