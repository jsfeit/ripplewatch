import { Badge } from "@/components/ui/badge";
import { CircleDashed, ExternalLink, History } from "lucide-react";
import { cn, avatarColor } from "@/lib/utils";
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
  // "tier" (default): this account's plan caps how much gets scored (the
  // Starter teaser), so an unscored signal here is unscored on purpose —
  // matches the marketing site's mock examples, which don't have a real
  // account/tier behind them. "pending": the account's plan scores
  // everything, this signal just hasn't been picked up by a crawl yet (or,
  // rarely, hit a scoring error) — the tier-upsell copy would be actively
  // wrong here, so it gets different messaging.
  unscoredReason = "tier",
}: {
  signal: AlertCardSignal;
  competitorName: string;
  competitorInitial: string;
  // Overrides the initial-letter avatar with a custom icon — used on the
  // marketing site to brand a scored example as "Ripplewatch's read" rather
  // than the competitor's own icon.
  avatar?: React.ReactNode;
  unscoredReason?: "tier" | "pending";
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
              avatar ? "bg-primary text-primary-foreground" : avatarColor(competitorName)
            )}
          >
            {avatar ?? competitorInitial}
          </span>
          <div>
            <p className="text-sm font-medium leading-none">{competitorName}</p>
            <p className="mt-1 text-xs text-muted-foreground">{SIGNAL_TYPE_LABELS[signal.type]}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
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
        </div>
      </div>

      {signal.scored && signal.relevanceLevel ? (
        <>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                LEVEL_STYLES[signal.relevanceLevel]
              )}
            >
              {signal.relevanceLevel} relevance
            </span>
            {signal.id ? <SignalRatingControl signalId={signal.id} initialLabel={signal.evalLabel ?? null} /> : null}
          </div>
          <p className="mt-2 text-[15px] font-medium leading-relaxed text-foreground">
            {signal.relevanceReasoning}
          </p>
          <div className="mt-3 border-l-2 border-border/80 pl-3">
            {signal.url ? (
              <a
                href={signal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground/90 hover:text-foreground hover:underline"
              >
                {signal.title}
                <ExternalLink className="size-3 shrink-0" />
              </a>
            ) : (
              <p className="text-xs font-medium text-muted-foreground/90">{signal.title}</p>
            )}
            {signal.summary ? (
              <p className="mt-0.5 text-xs text-muted-foreground/70">{signal.summary}</p>
            ) : null}
          </div>
        </>
      ) : (
        <>
          {signal.url ? (
            <a
              href={signal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center gap-1.5 text-sm font-medium hover:underline"
            >
              {signal.title}
              <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
            </a>
          ) : (
            <p className="mt-3 text-sm font-medium">{signal.title}</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">{signal.summary}</p>
          <div className="mt-3 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            {unscoredReason === "tier"
              ? "No relevance score on this tier; upgrade to see why this would (or wouldn't) matter to you."
              : "Scoring in progress — check back after the next crawl."}
          </div>
        </>
      )}
    </div>
  );
}
