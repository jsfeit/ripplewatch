// The tools a customer keeps deals and calls in, so Ripplewatch can hand them
// the exact words to have their assistant pull from them. Chosen during setup
// and kept in this browser only: it's a convenience for tailoring prompts, not
// account data, and the assistant works fine without it.
import type { Audience } from "@/lib/sales-motion";

export type DealToolKind = "crm" | "calls" | "support" | "billing" | "feedback";

// `for` is who the tool is useful to: support tools serve both kinds of company.
export const DEAL_TOOLS: { id: string; label: string; kind: DealToolKind; for: "business" | "consumer" | "both" }[] = [
  { id: "hubspot", label: "HubSpot", kind: "crm", for: "business" },
  { id: "salesforce", label: "Salesforce", kind: "crm", for: "business" },
  { id: "gong", label: "Gong", kind: "calls", for: "business" },
  { id: "zoom", label: "Zoom", kind: "calls", for: "business" },
  { id: "intercom", label: "Intercom", kind: "support", for: "both" },
  { id: "zendesk", label: "Zendesk", kind: "support", for: "both" },
  { id: "stripe", label: "Stripe", kind: "billing", for: "consumer" },
  { id: "shopify", label: "Shopify", kind: "billing", for: "consumer" },
  { id: "typeform", label: "Typeform", kind: "feedback", for: "consumer" },
];

// The tools worth offering to someone who sells to this audience. Unset shows
// the business set, which is what the step offered before there was a choice.
export function toolsForAudience(audience: Audience | null) {
  if (audience === "both") return DEAL_TOOLS;
  const want = audience === "consumer" ? "consumer" : "business";
  return DEAL_TOOLS.filter((t) => t.for === want || t.for === "both");
}

const STORAGE_KEY = "ripplewatch-deal-tools";

const CHANGE_EVENT = "ripplewatch-deal-tools-changed";

export function parseDealTools(raw: string | null): string[] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => DEAL_TOOLS.some((t) => t.id === id)) : [];
  } catch {
    return [];
  }
}

export function loadDealTools(): string[] {
  try {
    return parseDealTools(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveDealTools(ids: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Storage blocked: the prompts just stay generic.
  }
}

// For useSyncExternalStore, so a component can show the saved choice without a
// server/client mismatch: the server snapshot is always empty.
export function subscribeDealTools(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}
export function dealToolsSnapshot(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}
export const dealToolsServerSnapshot = () => "[]";

// A prompt that names the tool and what to read from it. Gong's connector
// returns call summaries rather than transcripts, so the call prompts ask for
// a one-line summary of where the competitor came up.
export function promptForTool(toolId: string, competitor: string): { tool: string; text: string } | null {
  const tool = DEAL_TOOLS.find((t) => t.id === toolId);
  if (!tool) return null;
  if (tool.kind === "crm") {
    return {
      tool: tool.label,
      text: `From ${tool.label}, pull the deals I lost in the last 90 days with the reason for each, and add them to Ripplewatch.`,
    };
  }
  if (tool.kind === "calls") {
    return {
      tool: tool.label,
      text: `In ${tool.label}, find calls from the last 30 days where ${competitor} came up, and log those mentions in Ripplewatch. A one-line summary of each is fine.`,
    };
  }
  if (tool.kind === "billing") {
    return {
      tool: tool.label,
      text: `From ${tool.label}, find customers who cancelled or stopped buying in the last 90 days, with the reason if there is one, and add them to Ripplewatch.`,
    };
  }
  if (tool.kind === "feedback") {
    return {
      tool: tool.label,
      text: `From ${tool.label}, pull recent responses about why customers chose us or left, especially any that name ${competitor}, and add them to Ripplewatch.`,
    };
  }
  return {
    tool: tool.label,
    text: `From ${tool.label}, find recent cancellations and why customers left, and add them to Ripplewatch.`,
  };
}

// Recurring prompts that keep deal data flowing without anyone logging it by
// hand. Both Claude and ChatGPT can run a prompt on a schedule, so the person
// pastes one in and says how often. Each names the tools they picked and asks
// the assistant to report what it added, so nothing happens silently.
export type ScheduledRecipe = { id: string; cadence: string; title: string; text: string };

function namesOf(kind: DealToolKind, selected: string[], fallback: string): string {
  const labels = DEAL_TOOLS.filter((t) => t.kind === kind && selected.includes(t.id)).map((t) => t.label);
  if (labels.length === 0) return fallback;
  return labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

// With no tools chosen, the CRM recipe is the useful default. Otherwise one
// recipe per kind of tool they use.
export function scheduledRecipes(selected: string[], audience: Audience | null = null): ScheduledRecipe[] {
  const has = (kind: DealToolKind) => DEAL_TOOLS.some((t) => t.kind === kind && selected.includes(t.id));
  const recipes: ScheduledRecipe[] = [];
  // A consumer company has no CRM to default to; its default is cancellations.
  if (has("crm") || (selected.length === 0 && audience !== "consumer")) {
    recipes.push({
      id: "crm",
      cadence: "Every Friday",
      title: "New lost deals",
      text: `Every Friday at 9am, pull the deals that closed lost this week from ${namesOf("crm", selected, "my CRM")}, with the reason for each, and add them to Ripplewatch. Tell me how many you added.`,
    });
  }
  if (has("calls")) {
    recipes.push({
      id: "calls",
      cadence: "First of the month",
      title: "Competitor mentions on calls",
      text: `On the first of every month, find calls from the past month in ${namesOf("calls", selected, "my call recorder")} where a competitor I track came up, and log those mentions in Ripplewatch. A one-line summary of each is fine. Tell me how many you logged.`,
    });
  }
  if (has("billing") || (selected.length === 0 && audience !== "business" && audience !== null)) {
    recipes.push({
      id: "billing",
      cadence: "Every Friday",
      title: "Customers who cancelled",
      text: `Every Friday at 9am, find the customers who cancelled or stopped buying this week in ${namesOf("billing", selected, "my billing or store tool")}, with the reason if there is one, and add them to Ripplewatch. Tell me how many you added.`,
    });
  }
  if (has("feedback")) {
    recipes.push({
      id: "feedback",
      cadence: "First of the month",
      title: "What customers say about us and others",
      text: `On the first of every month, pull the past month's responses from ${namesOf("feedback", selected, "my survey tool")} that say why customers chose us or left, especially any that name a competitor I track, and add them to Ripplewatch. Tell me how many you added.`,
    });
  }
  if (has("support")) {
    recipes.push({
      id: "support",
      cadence: "Every Friday",
      title: "Why customers left",
      text: `Every Friday at 9am, find the cancellations from this week in ${namesOf("support", selected, "my support tool")} and why each customer left, and add them to Ripplewatch. Tell me how many you added.`,
    });
  }
  return recipes;
}
