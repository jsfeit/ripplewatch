"use client";

import { cn } from "@/lib/utils";

export type BillingPeriod = "monthly" | "annual";

export function BillingPeriodToggle({
  period,
  onChange,
  discountPercent,
}: {
  period: BillingPeriod;
  onChange: (period: BillingPeriod) => void;
  discountPercent: number;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 p-1">
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className={cn(
          "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
          period === "monthly" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
        )}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange("annual")}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
          period === "annual" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
        )}
      >
        Annual
        <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
          Save {discountPercent}%
        </span>
      </button>
    </div>
  );
}
