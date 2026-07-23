"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SuggestedCompetitor = { name: string; domain: string };

// Matches the reference pattern: a logo tile grid with a checkmark badge for
// selected items. Selection writes straight into the shared competitors
// list (same state the manual rows above use) — there's no separate
// "confirm" step here, it's just another way to fill the same list.
function SuggestionTile({
  suggestion,
  selected,
  onToggle,
}: {
  suggestion: SuggestedCompetitor;
  selected: boolean;
  onToggle: () => void;
}) {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "relative flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors",
        selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-border/80 hover:bg-secondary/30"
      )}
    >
      {selected ? (
        <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3" />
        </span>
      ) : null}
      {suggestion.domain && !logoFailed ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary third-party logo URL, not a local asset
        <img
          src={`https://logo.clearbit.com/${suggestion.domain}`}
          alt=""
          className="h-9 w-full object-contain"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <span className="flex h-9 items-center justify-center text-sm font-semibold text-muted-foreground">
          {suggestion.name.charAt(0).toUpperCase()}
        </span>
      )}
      <p className="w-full truncate text-xs font-medium">{suggestion.name}</p>
    </button>
  );
}

export function SuggestedCompetitors({
  suggestions,
  loading,
  selectedNames,
  onToggle,
}: {
  suggestions: SuggestedCompetitor[] | null;
  loading: boolean;
  selectedNames: Set<string>;
  onToggle: (suggestion: SuggestedCompetitor) => void;
}) {
  if (!loading && (!suggestions || suggestions.length === 0)) return null;

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div>
        <p className="text-sm font-medium">Suggested competitors</p>
        <p className="text-xs text-muted-foreground">
          Based on your positioning and ICP — tap any to add them, no typing required.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Finding likely competitors…
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {suggestions!.map((suggestion) => (
            <SuggestionTile
              key={suggestion.name}
              suggestion={suggestion}
              selected={selectedNames.has(suggestion.name.toLowerCase())}
              onToggle={() => onToggle(suggestion)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
