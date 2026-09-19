// Shared by the activity beacon (client), the /api/activity route, and the
// admin views. No server-only imports so the client can use featureForPath.

// The in-app areas worth telling apart, keyed by the second path segment
// (/app/<segment>). Anything else under /app is bucketed as "other" rather
// than stored raw, so a query string or an id never ends up in the table.
export const FEATURES: Record<string, string> = {
  dashboard: "Dashboard",
  competitors: "Competitors",
  "win-loss": "Win/loss",
  trends: "Trends",
  pricing: "Pricing",
  hiring: "Hiring",
  "key-metrics": "Key metrics",
  ask: "Ask",
  settings: "Settings",
};

// "/app/competitors/abc123?x=1" -> "/app/competitors"; null if it isn't a
// customer app page we track.
export function featurePath(rawPath: string): string | null {
  const [pathOnly] = rawPath.split(/[?#]/);
  const parts = pathOnly.split("/").filter(Boolean);
  if (parts[0] !== "app") return null;
  const segment = parts[1];
  if (!segment) return "/app/dashboard";
  return FEATURES[segment] ? `/app/${segment}` : null;
}

export function featureLabel(path: string | null): string {
  const segment = path?.split("/")[2];
  return (segment && FEATURES[segment]) || "Other";
}

export type ActivityRow = { user_id: string; kind: "login" | "view"; path: string | null; created_at: string };

export type UserActivitySummary = {
  loginCount: number;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  // Page views per feature label, over whatever window the rows cover.
  features: Record<string, number>;
};

export function summarizeActivity(rows: ActivityRow[]): Map<string, UserActivitySummary> {
  const byUser = new Map<string, UserActivitySummary>();
  for (const r of rows) {
    let s = byUser.get(r.user_id);
    if (!s) {
      s = { loginCount: 0, lastLoginAt: null, lastActiveAt: null, features: {} };
      byUser.set(r.user_id, s);
    }
    if (!s.lastActiveAt || r.created_at > s.lastActiveAt) s.lastActiveAt = r.created_at;
    if (r.kind === "login") {
      s.loginCount += 1;
      if (!s.lastLoginAt || r.created_at > s.lastLoginAt) s.lastLoginAt = r.created_at;
    } else {
      const label = featureLabel(r.path);
      s.features[label] = (s.features[label] ?? 0) + 1;
    }
  }
  return byUser;
}

export function topFeatures(features: Record<string, number>, n = 3): [string, number][] {
  return Object.entries(features)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

export function relativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return "Never";
  const mins = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 60) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ISO timestamp N days ago. A function (not inline Date.now()) so server
// components can call it without tripping the render-purity lint.
export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}
