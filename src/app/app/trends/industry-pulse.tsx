"use client";

import { useMemo } from "react";
import { Globe2 } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/date";
import type { MonthlyActivityBucket } from "@/lib/monthly-activity";
import type { IndustryTrendItem } from "@/lib/supabase/types";

export function IndustryPulse({
  monthlyActivity,
  trends,
  trendsGeneratedAt,
}: {
  monthlyActivity: MonthlyActivityBucket[];
  trends: IndustryTrendItem[];
  trendsGeneratedAt: string | null;
}) {
  const hasActivity = monthlyActivity.some((m) => m.hiring > 0 || m.pricing > 0);

  if (!hasActivity && trends.length === 0) {
    return (
      <EmptyState
        icon={Globe2}
        title="No industry activity yet"
        description="Hiring/pricing activity across your competitors, plus a monthly market-trends summary, will show up here once there's data to work with."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Panel className="p-4">
        <p className="text-xs font-semibold text-muted-foreground">
          Category activity, last 6 months
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Hiring and pricing changes across every tracked competitor combined.
        </p>
        {hasActivity ? (
          <ActivityChart data={monthlyActivity} />
        ) : (
          <p className="mt-6 text-xs text-muted-foreground">Not enough activity yet.</p>
        )}
      </Panel>

      <Panel className="p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold text-muted-foreground">Market trends</p>
          {trendsGeneratedAt ? (
            <span className="text-[10.5px] text-muted-foreground">Updated {timeAgo(trendsGeneratedAt)}</span>
          ) : null}
        </div>
        {trends.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Generates monthly, scoped to your positioning and ICP; check back soon.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {trends.map((t) => (
              <li key={t.title} className="border-b border-dashed border-border pb-3 last:border-b-0 last:pb-0">
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  {t.category}
                </Badge>
                <p className="mt-1.5 text-sm font-medium">{t.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.description}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function ActivityChart({ data }: { data: MonthlyActivityBucket[] }) {
  const max = useMemo(() => Math.max(1, ...data.flatMap((m) => [m.hiring, m.pricing])), [data]);
  const CHART_HEIGHT = 96;

  return (
    <div>
      <div className="mt-5 flex items-end gap-3">
        {data.map((month) => (
          <div key={month.label} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-24 items-end gap-1">
              <div
                title={`${month.label}: ${month.hiring} hiring`}
                className="w-2.5 rounded-t-sm bg-chart-1"
                style={{ height: `${Math.max(2, (month.hiring / max) * CHART_HEIGHT)}px` }}
              />
              <div
                title={`${month.label}: ${month.pricing} pricing`}
                className="w-2.5 rounded-t-sm bg-chart-3"
                style={{ height: `${Math.max(2, (month.pricing / max) * CHART_HEIGHT)}px` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{month.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-4 border-t border-dashed border-border pt-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-chart-1" />
          Hiring
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-chart-3" />
          Pricing activity
        </span>
      </div>
    </div>
  );
}
