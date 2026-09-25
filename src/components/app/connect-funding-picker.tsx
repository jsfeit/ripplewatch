"use client";

import { cn } from "@/lib/utils";
import { CONNECT_FUNDING_OPTIONS_USD, CONNECT_MIN_FUNDING_USD } from "@/lib/connect-pricing";

// Chooses how much to put in the prepaid balance. The presets cover most
// people; "Other" takes any whole dollar amount at or above the minimum.
// Used by the purchase flow and by "Add funds" in Settings.
export function ConnectFundingPicker({
  value,
  onChange,
  custom,
  onCustomChange,
}: {
  value: number | "custom";
  onChange: (value: number | "custom") => void;
  custom: string;
  onCustomChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {CONNECT_FUNDING_OPTIONS_USD.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => onChange(amount)}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              value === amount ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
            )}
          >
            ${amount}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange("custom")}
          className={cn(
            "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            value === "custom" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
          )}
        >
          Other
        </button>
      </div>
      {value === "custom" ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">$</span>
          <input
            type="number"
            min={CONNECT_MIN_FUNDING_USD}
            step={1}
            inputMode="numeric"
            value={custom}
            onChange={(e) => onCustomChange(e.target.value)}
            placeholder={`${CONNECT_MIN_FUNDING_USD} or more`}
            className="h-9 w-40 rounded-md border border-input bg-transparent px-3 text-sm"
          />
        </div>
      ) : null}
    </div>
  );
}

// The dollar amount a picker state represents, or null if it isn't valid yet.
export function fundingFromPicker(value: number | "custom", custom: string): number | null {
  const n = value === "custom" ? Number(custom) : value;
  return Number.isInteger(n) && n >= CONNECT_MIN_FUNDING_USD ? n : null;
}
