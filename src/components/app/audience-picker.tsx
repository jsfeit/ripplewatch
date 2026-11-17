"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import {
  AUDIENCES,
  audienceServerSnapshot,
  audienceSnapshot,
  parseAudience,
  saveAudience,
  subscribeAudience,
  type Audience,
} from "@/lib/sales-motion";

// This browser's saved answer to "who do you sell to", read without a
// server/client mismatch. null until they pick.
export function useAudience(): Audience | null {
  return parseAudience(useSyncExternalStore(subscribeAudience, audienceSnapshot, audienceServerSnapshot));
}

export function AudiencePicker({ className }: { className?: string }) {
  const audience = useAudience();
  return (
    <div className={className}>
      <p className="text-sm font-medium" id="audience-label">
        Who do you sell to?
      </p>
      <div role="radiogroup" aria-labelledby="audience-label" className="mt-2 grid gap-2 sm:grid-cols-3">
        {AUDIENCES.map((a) => {
          const on = audience === a.id;
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => saveAudience(a.id)}
              className={cn(
                "rounded-md border px-3 py-2 text-left",
                on ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
              )}
            >
              <span className={cn("block text-sm font-medium", on ? "text-primary" : "")}>{a.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{a.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
