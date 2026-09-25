// Shared tier → color mapping so the plan indicator looks the same in the
// sidebar, Settings, and anywhere else a tier badge shows up.
export const TIER_DOT: Record<string, string> = {
  starter: "bg-muted-foreground/50",
  plus: "bg-primary",
};

export const TIER_BADGE: Record<string, string> = {
  starter: "bg-secondary text-secondary-foreground",
  plus: "bg-primary/15 text-primary",
};
