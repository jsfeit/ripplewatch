// The tools a customer keeps deals and calls in, so Ripplewatch can hand them
// the exact words to have their assistant pull from them. Chosen during setup
// and kept in this browser only: it's a convenience for tailoring prompts, not
// account data, and the assistant works fine without it.
export type DealToolKind = "crm" | "calls" | "support";

export const DEAL_TOOLS: { id: string; label: string; kind: DealToolKind }[] = [
  { id: "hubspot", label: "HubSpot", kind: "crm" },
  { id: "salesforce", label: "Salesforce", kind: "crm" },
  { id: "gong", label: "Gong", kind: "calls" },
  { id: "zoom", label: "Zoom", kind: "calls" },
  { id: "intercom", label: "Intercom", kind: "support" },
  { id: "zendesk", label: "Zendesk", kind: "support" },
];

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
  return {
    tool: tool.label,
    text: `From ${tool.label}, find recent cancellations and why customers left, and add them to Ripplewatch.`,
  };
}

// What to say to keep deal data flowing without logging it by hand: a recurring
// task, if the person's assistant can run scheduled tasks.
export const SCHEDULED_RECIPE =
  "Every Friday, pull the deals that closed lost this week from my CRM, with the reason for each, and add them to Ripplewatch.";
