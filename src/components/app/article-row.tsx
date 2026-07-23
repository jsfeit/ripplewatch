import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, avatarColor } from "@/lib/utils";
import { SIGNAL_TYPE_LABELS } from "@/lib/mock-data";
import type { RelevanceLevel, SignalType } from "@/lib/supabase/types";

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

export type ArticleRowSignal = {
  type: SignalType;
  title: string;
  url: string | null;
  scored: boolean;
  relevanceLevel?: RelevanceLevel | null;
  relevanceReasoning?: string | null;
};

// A ranked, exhaustive list of every signal with a source to click through
// to — the body text is always "what this means to us," never the raw
// article summary, since that's the whole point of this tab over just
// reading the news yourself.
export function ArticleRow({
  signal,
  competitorName,
  competitorInitial,
}: {
  signal: ArticleRowSignal;
  competitorName: string;
  competitorInitial: string;
}) {
  const TitleTag = signal.url ? "a" : "p";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card p-4 pl-5",
        "before:absolute before:inset-y-0 before:left-0 before:w-1",
        signal.scored && signal.relevanceLevel ? LEVEL_EDGE[signal.relevanceLevel] : "before:bg-border",
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
        {signal.scored && signal.relevanceLevel ? (
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
              LEVEL_STYLES[signal.relevanceLevel]
            )}
          >
            {signal.relevanceLevel} relevance
          </span>
        ) : (
          <Badge variant="outline" className="shrink-0 text-muted-foreground">
            Not yet scored
          </Badge>
        )}
      </div>

      <TitleTag
        {...(signal.url ? { href: signal.url, target: "_blank", rel: "noopener noreferrer" } : {})}
        className={cn(
          "mt-3 flex items-center gap-1.5 text-sm font-medium",
          signal.url && "hover:underline"
        )}
      >
        {signal.title}
        {signal.url ? <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" /> : null}
      </TitleTag>

      {signal.scored && signal.relevanceLevel ? (
        <p className="mt-2 text-sm leading-relaxed text-foreground/90">{signal.relevanceReasoning}</p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Upgrade to see why this would (or wouldn&apos;t) matter to you.
        </p>
      )}
    </div>
  );
}
