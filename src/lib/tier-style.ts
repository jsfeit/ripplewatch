// Shared tier → color mapping so the plan indicator looks the same in the
// sidebar, Settings, and anywhere else a tier badge shows up.
export const TIER_DOT: Record<string, string> = {
  plus: "bg-primary",
  connect: "bg-chart-2",
};

export const TIER_BADGE: Record<string, string> = {
  plus: "bg-primary/15 text-primary",
  connect: "bg-chart-2/20 text-chart-2",
};
