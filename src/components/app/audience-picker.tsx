"use client";

import { cn } from "@/lib/utils";
import { AUDIENCES, type Audience } from "@/lib/sales-motion";

// "Who do you sell to?" B2B, B2C or both. Controlled: the parent saves the choice on the account.
export function AudiencePicker({
  value,
  onChange,
  note,
  className,
}: {
  value: Audience | null;
  onChange: (next: Audience) => void;
  // Shown under the choice, for example why a default was picked.
  note?: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-sm font-medium" id="audience-label">
        Who do you sell to?
      </p>
      <div role="radiogroup" aria-labelledby="audience-label" className="mt-2 grid gap-2 sm:grid-cols-3">
        {AUDIENCES.map((a) => {
          const on = value === a.id;
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(a.id)}
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
      {note ? <p className="mt-2 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

// Saves the choice on the account. Fire and forget: the screen has already updated, and a failed
// save just means the next screen asks again.
export function saveSellsTo(value: Audience): void {
  void fetch("/api/connect/sells-to", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sellsTo: value }),
  }).catch(() => {});
}
