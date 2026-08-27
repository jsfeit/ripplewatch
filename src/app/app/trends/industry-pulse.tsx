"use client";

import { useMemo, useState } from "react";
import { Globe2, ChevronDown, TrendingUp, BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { Card, CardAvatar, CardHead } from "@/components/app/card";
import { Badge } from "@/components/ui/badge";
import { cn, avatarDotColor } from "@/lib/utils";
import { timeAgo } from "@/lib/date";
import type { MonthlyActivityBucket } from "@/lib/monthly-activity";
import type { IndustryTrendItem } from "@/lib/supabase/types";

// Below this, 6 months of combined hiring+pricing activity across every
// tracked competitor is thin enough that the chart reads as "broken," not
// "quiet" — collapsed by default in that case so it doesn't compete with
// the market-trends synthesis (the actual value-add) for attention. Still
// always one click away either way; this only sets the default.
const MEANINGFUL_ACTIVITY_THRESHOLD = 6;

export function IndustryPulse({
  monthlyActivity,
  trends,
  trendsGeneratedAt,
}: {
  monthlyActivity: MonthlyActivityBucket[];
  trends: IndustryTrendItem[];
  trendsGeneratedAt: string | null;
}) {
  const totalActivity = monthlyActivity.reduce((sum, m) => sum + m.hiring + m.pricing, 0);
  const hasActivity = totalActivity > 0;
  const [chartExpanded, setChartExpanded] = useState(totalActivity >= MEANINGFUL_ACTIVITY_THRESHOLD);

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
    <div className="space-y-4">
      <Card>
        <CardHead
          avatar={<CardAvatar icon={<TrendingUp className="size-4" />} />}
          title="Market trends"
          meta={trendsGeneratedAt ? <span className="text-[10.5px] text-muted-foreground">Updated {timeAgo(trendsGeneratedAt)}</span> : null}
        />
        {trends.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Generates on your first crawl and monthly after that, scoped to your positioning and ICP; check back
            soon.
          </p>
        ) : (
          <ul className="space-y-3">
            {trends.map((t) => (
              <li key={t.title} className="border-b border-dashed border-border pb-3 last:border-b-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    {t.category}
                  </Badge>
                  {t.relatedCompetitors.map((name) => (
                    <span
                      key={name}
                      className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      <span className={cn("size-1.5 rounded-full", avatarDotColor(name))} />
                      {name}
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-sm font-medium">{t.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.description}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {hasActivity ? (
        <Card>
          <button
            type="button"
            onClick={() => setChartExpanded((e) => !e)}
            className="flex w-full items-center justify-between text-left"
          >
            <CardHead
              avatar={<CardAvatar icon={<BarChart3 className="size-4" />} />}
              title="Category activity, last 6 months"
              eyebrow="Hiring and pricing changes across every tracked competitor combined."
              className="flex-1"
            />
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                chartExpanded && "rotate-180"
              )}
            />
          </button>
          {chartExpanded ? <ActivityChart data={monthlyActivity} /> : null}
        </Card>
      ) : null}
    </div>
  );
}

function ActivityChart({ data }: { data: MonthlyActivityBucket[] }) {
  const max = useMemo(() => Math.max(1, ...data.flatMap((m) => [m.hiring, m.pricing])), [data]);
  const CHART_HEIGHT = 96;

  return (
    <div>
      <div className="mt-2 flex items-end gap-3">
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
