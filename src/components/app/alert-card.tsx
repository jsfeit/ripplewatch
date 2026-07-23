import { Badge } from "@/components/ui/badge";
import { Sparkles, CircleDashed } from "lucide-react";
import { cn, avatarColor } from "@/lib/utils";
import { SIGNAL_TYPE_LABELS } from "@/lib/mock-data";
import type { SignalType, RelevanceLevel } from "@/lib/supabase/types";

const LEVEL_STYLES: Record<string, string> = {
  High: "bg-primary/15 text-primary border-primary/30",
  Medium: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400",
  Low: "bg-muted text-muted-foreground border-border",
};

const LEVEL_EDGE: Record<string, string> = {
  High: "before:bg-primary",
  Medium: "before:bg-amber-500",
  Low: "before:bg-muted-foreground/40",
};

// Decoupled from both the mock-data shape and the raw Supabase row shape —
// callers adapt whichever source they have into this.
export type AlertCardSignal = {
  type: SignalType;
  title: string;
  summary: string | null;
  scored: boolean;
  relevanceLevel?: RelevanceLevel | null;
  relevanceReasoning?: string | null;
};

export function AlertCard({
  signal,
  competitorName,
  competitorInitial,
}: {
  signal: AlertCardSignal;
  competitorName: string;
  competitorInitial: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card p-4 pl-5 transition-colors",
        "before:absolute before:inset-y-0 before:left-0 before:w-1",
        signal.scored && signal.relevanceLevel
          ? LEVEL_EDGE[signal.relevanceLevel]
          : "before:bg-border",
        signal.scored ? "border-primary/25" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              avatarColor(competitorName)
            )}
          >
            {competitorInitial}
          </span>
          <div>
            <p className="text-sm font-medium leading-none">{competitorName}</p>
            <p className="mt-1 text-xs text-muted-foreground">{SIGNAL_TYPE_LABELS[signal.type]}</p>
          </div>
        </div>
        {signal.scored ? (
          <Badge className="gap-1 border-primary/30 bg-primary/10 text-primary hover:bg-primary/10">
            <Sparkles className="size-3" />
            Scored
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <CircleDashed className="size-3" />
            Raw signal
          </Badge>
        )}
      </div>

      {signal.scored && signal.relevanceLevel ? (
        <>
          <div className="mt-3 flex items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                LEVEL_STYLES[signal.relevanceLevel]
              )}
            >
              {signal.relevanceLevel} relevance
            </span>
          </div>
          <p className="mt-2 text-[15px] font-medium leading-relaxed text-foreground">
            {signal.relevanceReasoning}
          </p>
          <div className="mt-3 border-l-2 border-border/80 pl-3">
            <p className="text-xs font-medium text-muted-foreground/90">{signal.title}</p>
            {signal.summary ? (
              <p className="mt-0.5 text-xs text-muted-foreground/70">{signal.summary}</p>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm font-medium">{signal.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{signal.summary}</p>
          <div className="mt-3 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            No relevance score on this tier — upgrade to see why this would (or wouldn&apos;t) matter to you.
          </div>
        </>
      )}
    </div>
  );
}
