import { Badge } from "@/components/ui/badge";
import { CircleDashed, ExternalLink, History } from "lucide-react";
import { Card, CardAvatar, CardFoot, CardHead } from "@/components/app/card";
import { cn } from "@/lib/utils";
import { SIGNAL_TYPE_LABELS } from "@/lib/mock-data";
import { SignalRatingControl } from "@/components/app/signal-rating-control";
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
  relevanceScore?: number | null;
  relevanceReasoning?: string | null;
  // Absent on the marketing site's mock examples, which have no real source
  // to link to; present for every real signal in the app.
  url?: string | null;
  // True when the article's real publish date is older than the dashboard's
  // recency window (see signal-freshness.ts) — badged "Background" so an
  // old article doesn't read as if it just happened. Based on the article's
  // actual age, not on how it was sourced: a competitor's very first crawl
  // can still turn up genuinely fresh news, which shouldn't get this badge
  // just because of when it was discovered.
  isBackground?: boolean;
  // Absent on marketing-site mock examples (no real row to rate) and on
  // unscored signals (nothing to judge the accuracy of yet).
  id?: string;
  evalLabel?: "correct" | "incorrect" | null;
};

export function AlertCard({
  signal,
  competitorName,
  competitorInitial,
  avatar,
}: {
  signal: AlertCardSignal;
  competitorName: string;
  competitorInitial: string;
  // Overrides the initial-letter avatar with a custom icon — used on the
  // marketing site to brand a scored example as "Ripplewatch's read" rather
  // than the competitor's own icon.
  avatar?: React.ReactNode;
}) {
  const titleLink = signal.url ? (
    <a
      href={signal.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:text-primary hover:underline"
    >
      {signal.title}
      <ExternalLink className="size-3 shrink-0" />
    </a>
  ) : (
    <span className="text-xs font-semibold text-foreground">{signal.title}</span>
  );

  return (
    <Card
      data-tour={signal.scored && signal.relevanceLevel ? "relevance-badge" : undefined}
      className={cn(
        "relative overflow-hidden pl-5 transition-colors",
        "before:absolute before:inset-y-0 before:left-0 before:w-1",
        signal.scored && signal.relevanceLevel ? LEVEL_EDGE[signal.relevanceLevel] : "before:bg-border",
        signal.scored ? "border-primary/25" : "border-border"
      )}
    >
      <CardHead
        avatar={
          avatar ? (
            <CardAvatar icon={avatar} className="rounded-full bg-primary text-primary-foreground" />
          ) : (
            <CardAvatar seed={competitorName} />
          )
        }
        title={competitorName}
        eyebrow={SIGNAL_TYPE_LABELS[signal.type]}
        meta={
          <>
            {signal.isBackground ? (
              <Badge variant="outline" className="gap-1 text-muted-foreground" title="Older article, not recently discovered">
                <History className="size-3" />
                Background
              </Badge>
            ) : null}
            {signal.scored && signal.relevanceScore !== null && signal.relevanceScore !== undefined ? (
              <Badge
                className={cn(
                  "border font-semibold tabular-nums",
                  signal.relevanceLevel ? LEVEL_STYLES[signal.relevanceLevel] : "border-primary/30 bg-primary/10 text-primary"
                )}
                title="Relevance score, 0-100"
              >
                {signal.relevanceScore}
              </Badge>
            ) : signal.scored ? (
              <Badge className="border-primary/30 bg-primary/10 text-primary">Scored</Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <CircleDashed className="size-3" />
                Raw signal
              </Badge>
            )}
          </>
        }
      />

      {signal.scored && signal.relevanceLevel ? (
        <>
          <span
            className={cn(
              "w-fit rounded-full border px-2 py-0.5 text-[11px] font-semibold",
              LEVEL_STYLES[signal.relevanceLevel]
            )}
          >
            {signal.relevanceLevel} relevance
          </span>
          <p className="text-[15px] font-medium leading-relaxed text-foreground">{signal.relevanceReasoning}</p>
          {signal.summary ? <p className="text-xs text-muted-foreground">{signal.summary}</p> : null}
          <CardFoot>
            {titleLink}
            {signal.id ? <SignalRatingControl signalId={signal.id} initialLabel={signal.evalLabel ?? null} /> : <span />}
          </CardFoot>
        </>
      ) : (
        <>
          {signal.url ? (
            <a
              href={signal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium hover:underline"
            >
              {signal.title}
              <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
            </a>
          ) : (
            <p className="text-sm font-medium">{signal.title}</p>
          )}
          <p className="text-sm text-muted-foreground">{signal.summary}</p>
          <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            Scoring in progress, check back after the next crawl.
          </div>
        </>
      )}
    </Card>
  );
}
