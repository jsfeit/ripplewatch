import * as React from "react";
import { cn } from "@/lib/utils";

// The app's de facto second "card" primitive: a plain bordered box for
// arbitrary content, as distinct from Card's title/content/footer compound
// API. Extracted because the exact same four classes (rounded corner,
// border, bg-card, padding) were hand-rolled independently in 30+ places —
// this is a same-output consolidation, not a restyle, so existing callers
// pass their own padding/gap via className exactly as before.
export function Panel({
  className,
  radius = "xl",
  dashed = false,
  ...props
}: React.ComponentProps<"div"> & { radius?: "lg" | "xl"; dashed?: boolean }) {
  return (
    <div
      className={cn(
        radius === "lg" ? "rounded-lg" : "rounded-xl",
        "border bg-card",
        dashed ? "border-dashed border-border" : "border-border",
        className
      )}
      {...props}
    />
  );
}
