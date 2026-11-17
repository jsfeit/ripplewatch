"use client";

import { cn } from "@/lib/utils";
import { AUDIENCES, type Audience } from "@/lib/sales-motion";

// "Who do you sell to?" B2B, B2C or both, on one line. Controlled: the parent saves the choice on the account.
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
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium" id="audience-label">
          Who do you sell to?
        </p>
        <div role="radiogroup" aria-labelledby="audience-label" className="flex gap-2">
          {AUDIENCES.map((a) => {
            const on = value === a.id;
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={on}
                title={a.hint}
                onClick={() => onChange(a.id)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium",
                  on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                )}
              >
                {a.label}
              </button>
            );
          })}
        </div>
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
