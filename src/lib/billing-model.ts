import type { BillingModel } from "@/lib/supabase/types";

export const BILLING_MODEL_LABELS: Record<BillingModel, string> = {
  subscription: "Flat subscription",
  per_seat: "Per-seat",
  usage_based: "Usage-based",
  custom: "Custom / quote",
  unknown: "Unknown",
};

// Reuses the app's chart-N palette so this reads as part of the same design
// system as the relevance/tier color language elsewhere.
export const BILLING_MODEL_STYLES: Record<BillingModel, string> = {
  subscription: "bg-primary/10 text-primary",
  per_seat: "bg-chart-2/15 text-chart-2",
  usage_based: "bg-chart-3/20 text-chart-3",
  custom: "bg-muted text-muted-foreground",
  unknown: "bg-muted text-muted-foreground",
};

export const BILLING_MODEL_DOT: Record<BillingModel, string> = {
  subscription: "bg-primary",
  per_seat: "bg-chart-2",
  usage_based: "bg-chart-3",
  custom: "bg-muted-foreground/50",
  unknown: "bg-muted-foreground/50",
};
