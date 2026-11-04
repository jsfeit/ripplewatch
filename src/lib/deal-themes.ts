// The fixed vocabulary a deal's free-text reason is read into. A closed list keeps counts meaningful
// ("7 losses cited price this quarter") instead of every reason being its own one-off phrase, and
// lets a loss theme be lined up against the kind of competitor move that could explain it.

export const DEAL_THEMES = [
  "price",
  "missing_feature",
  "integration",
  "security_compliance",
  "performance_reliability",
  "ease_of_use",
  "support_service",
  "brand_trust",
  "no_decision",
  "status_quo",
  "timing_budget",
  "champion_change",
  "other",
] as const;

export type DealTheme = (typeof DEAL_THEMES)[number];

export const DEAL_THEME_LABELS: Record<DealTheme, string> = {
  price: "Price",
  missing_feature: "Missing a feature",
  integration: "Integrations",
  security_compliance: "Security or compliance",
  performance_reliability: "Performance or reliability",
  ease_of_use: "Ease of use",
  support_service: "Support or service",
  brand_trust: "Brand or trust",
  no_decision: "No decision",
  status_quo: "Stayed with the current tool or built in-house",
  timing_budget: "Timing or budget",
  champion_change: "Champion left or changed",
  other: "Other",
};

export function isDealTheme(value: string): value is DealTheme {
  return (DEAL_THEMES as readonly string[]).includes(value);
}

// Which kinds of competitor activity can plausibly explain a loss theme. Used to look for moves that
// land near a spike in that theme; it only names candidates, it never claims a cause.
export const THEME_SIGNAL_TYPES: Partial<Record<DealTheme, string[]>> = {
  price: ["pricing"],
  missing_feature: ["product_change", "news"],
  integration: ["product_change", "news"],
  security_compliance: ["product_change", "news"],
  performance_reliability: ["review", "product_change"],
  ease_of_use: ["review", "product_change"],
  support_service: ["review"],
  brand_trust: ["news", "funding", "review"],
};
