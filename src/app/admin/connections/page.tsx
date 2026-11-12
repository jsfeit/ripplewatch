import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "AI connections | Admin" };
export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

// Wrapped so the render doesn't call an impure function directly (react-hooks/purity); this page
// is dynamic and always renders on the server per request.
function nowMs(): number {
  return Date.now();
}

// The day Ripplewatch went live in ChatGPT's plugin directory. ChatGPT connections before this came
// from the manual developer-mode setup; after it, mostly from the directory.
const CHATGPT_LAUNCH = "2026-11-10";
const WEEKS_SHOWN = 8;

type Group = "claude" | "chatgpt" | "other";

const GROUPS: { id: Group; label: string; dot: string; bar: string }[] = [
  { id: "claude", label: "Claude", dot: "bg-amber-500", bar: "bg-amber-500/70" },
  { id: "chatgpt", label: "ChatGPT", dot: "bg-emerald-500", bar: "bg-emerald-500/70" },
  { id: "other", label: "Other", dot: "bg-slate-400", bar: "bg-slate-400/60" },
];

// Cursor, Glama's health checker, unknown clients and anything else all roll up into Other.
function groupOf(assistant: string): Group {
  return assistant === "claude" || assistant === "chatgpt" ? assistant : "other";
}

// Monday 00:00 UTC of the week containing the date, as YYYY-MM-DD.
function weekStart(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function ago(iso: string | null, now: number): string {
  if (!iso) return "never";
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  if (mins < 60 * 48) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

function shortDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

type Status = "Active" | "Quiet" | "Dormant" | "Never used";

function statusOf(lastSeen: string | null, now: number): Status {
  if (!lastSeen) return "Never used";
  const age = now - new Date(lastSeen).getTime();
  if (age <= 7 * DAY) return "Active";
  if (age <= 30 * DAY) return "Quiet";
  return "Dormant";
}

const STATUS_STYLE: Record<Status, string> = {
  Active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  Quiet: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Dormant: "bg-secondary text-muted-foreground",
  "Never used": "bg-secondary text-muted-foreground",
};

export default async function AdminConnectionsPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const { demo } = await searchParams;
  const includeDemo = demo === "1";
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mcp_connections")
    .select("id, account_id, client_name, redirect_host, assistant, first_connected_at, last_seen_at, request_count")
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .limit(500);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">AI connections</h1>
        <p className="mt-4 rounded-md border border-border bg-secondary/40 p-4 text-sm">
          Can&apos;t read the mcp_connections table yet. If migration 0088 hasn&apos;t been applied, run it in the Supabase SQL
          editor and reload. ({error.message})
        </p>
      </div>
    );
  }

  const allRows = data ?? [];
  const accountIds = [...new Set(allRows.map((r) => r.account_id))];
  const { data: accounts } = accountIds.length
    ? await admin.from("accounts").select("id, name, status, demo_mode").in("id", accountIds)
    : { data: [] };
  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));

  const isDemo = (accountId: string) => Boolean(accountById.get(accountId)?.demo_mode);
  const rows = includeDemo ? allRows : allRows.filter((r) => !isDemo(r.account_id));
  const hiddenDemo = allRows.filter((r) => isDemo(r.account_id)).length;
  const now = nowMs();

  const stats = GROUPS.map((g) => {
    const mine = rows.filter((r) => groupOf(r.assistant) === g.id);
    const accountSet = new Set(mine.map((r) => r.account_id));
    const active = new Set(
      mine.filter((r) => r.last_seen_at && now - new Date(r.last_seen_at).getTime() <= 7 * DAY).map((r) => r.account_id)
    );
    const since = new Set(mine.filter((r) => r.first_connected_at >= CHATGPT_LAUNCH).map((r) => r.account_id));
    const lastSeen = mine.reduce<string | null>(
      (latest, r) => (r.last_seen_at && (!latest || r.last_seen_at > latest) ? r.last_seen_at : latest),
      null
    );
    return {
      ...g,
      accounts: accountSet.size,
      active: active.size,
      since: since.size,
      requests: mine.reduce((sum, r) => sum + r.request_count, 0),
      lastSeen,
    };
  });
  const main = stats.filter((s) => s.id !== "other");
  const other = stats.find((s) => s.id === "other")!;

  // New accounts per week, per group, newest week first.
  const thisWeek = new Date(weekStart(new Date(now).toISOString()) + "T00:00:00Z").getTime();
  const weeks = Array.from({ length: WEEKS_SHOWN }, (_, i) => new Date(thisWeek - i * 7 * DAY).toISOString().slice(0, 10));
  const weekly = new Map<string, Record<Group, Set<string>>>();
  for (const r of rows) {
    const wk = weekStart(r.first_connected_at);
    const entry = weekly.get(wk) ?? { claude: new Set(), chatgpt: new Set(), other: new Set() };
    entry[groupOf(r.assistant)].add(r.account_id);
    weekly.set(wk, entry);
  }
  const countAt = (wk: string, g: Group) => weekly.get(wk)?.[g].size ?? 0;
  const maxWeekly = Math.max(1, ...weeks.flatMap((wk) => GROUPS.map((g) => countAt(wk, g.id))));
  const launchWeek = weekStart(CHATGPT_LAUNCH + "T12:00:00Z");
  const showOther = other.accounts > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-8 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI connections</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Which AI assistant each customer connected to Ripplewatch, and whether they&apos;re still using it.
        </p>
      </div>

      {/* Claude and ChatGPT side by side, always shown, even at zero. */}
      <section aria-label="Claude and ChatGPT" className="grid gap-4 sm:grid-cols-2">
        {main.map((s) => (
          <Card key={s.id}>
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center gap-2">
                <span className={`size-2.5 rounded-full ${s.dot}`} aria-hidden />
                <h2 className="text-sm font-semibold">{s.label}</h2>
              </div>
              <div>
                <p className="text-4xl font-semibold tabular-nums">{s.accounts}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {s.accounts === 1 ? "account connected" : "accounts connected"}
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-3 border-t border-border pt-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Active, 7 days</dt>
                  <dd className="mt-0.5 font-medium tabular-nums">{s.active}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Requests</dt>
                  <dd className="mt-0.5 font-medium tabular-nums">{s.requests.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Last active</dt>
                  <dd className="mt-0.5 font-medium">{ago(s.lastSeen, now)}</dd>
                </div>
              </dl>
              {s.id === "chatgpt" ? (
                <p className="rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
                  Plugin directory launched {shortDate(CHATGPT_LAUNCH + "T12:00:00Z")}.{" "}
                  <span className="font-medium text-foreground">{s.since}</span> new{" "}
                  {s.since === 1 ? "account" : "accounts"} since.
                </p>
              ) : null}
              {s.accounts === 0 ? (
                <p className="text-xs text-muted-foreground">No customer connections yet.</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </section>

      {showOther ? (
        <p className="-mt-4 text-sm text-muted-foreground">
          Also connected: <span className="font-medium text-foreground tabular-nums">{other.accounts}</span> through other
          clients (Cursor, VS Code, API keys and the like), {other.active} active in the last 7 days.
        </p>
      ) : null}

      {/* Last eight weeks of first-time connections. */}
      <section aria-label="New connections per week">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">New connections per week</h2>
          <p className="text-xs text-muted-foreground">First-time accounts, by the week of first connection. Weeks start Monday (UTC).</p>
        </div>
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Week of</th>
                  {GROUPS.filter((g) => g.id !== "other" || showOther).map((g) => (
                    <th key={g.id} className="px-4 py-2 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`size-2 rounded-full ${g.dot}`} aria-hidden />
                        {g.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((wk) => (
                  <tr key={wk} className={`border-b border-border/60 last:border-0 ${wk === launchWeek ? "bg-primary/5" : ""}`}>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {shortDate(wk + "T00:00:00Z")}
                      {wk === launchWeek ? (
                        <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          ChatGPT plugin live
                        </span>
                      ) : null}
                    </td>
                    {GROUPS.filter((g) => g.id !== "other" || showOther).map((g) => {
                      const n = countAt(wk, g.id);
                      return (
                        <td key={g.id} className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className={`w-5 tabular-nums ${n ? "font-medium" : "text-muted-foreground/50"}`}>{n || "·"}</span>
                            {n ? (
                              <span
                                className={`h-2 rounded-full ${g.bar}`}
                                style={{ width: `${Math.max(8, (n / maxWeekly) * 120)}px` }}
                                aria-hidden
                              />
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      {/* Every connection, most recently used first. */}
      <section aria-label="All connections">
        <h2 className="mb-3 text-sm font-semibold">Connections</h2>
        <Card>
          <CardContent className="overflow-x-auto p-0">
            {rows.length ? (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Assistant</th>
                    <th className="px-4 py-2 font-medium">Account</th>
                    <th className="px-4 py-2 font-medium">Connected</th>
                    <th className="px-4 py-2 font-medium">Last active</th>
                    <th className="px-4 py-2 text-right font-medium">Requests</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const account = accountById.get(r.account_id);
                    const g = GROUPS.find((x) => x.id === groupOf(r.assistant))!;
                    const status = statusOf(r.last_seen_at, now);
                    const detail = [r.client_name, r.redirect_host].filter(Boolean).join(" · ");
                    return (
                      <tr key={r.id} className="border-b border-border/60 last:border-0">
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <span className={`size-2 rounded-full ${g.dot}`} aria-hidden />
                            {r.assistant === "claude" || r.assistant === "chatgpt"
                              ? g.label
                              : r.assistant.charAt(0).toUpperCase() + r.assistant.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            {account?.name ?? "-"}
                            {account?.demo_mode ? (
                              <span className="ml-1.5 rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">demo</span>
                            ) : null}
                          </div>
                          {detail ? <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div> : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {shortDate(r.first_connected_at)}
                          <span className="ml-1 text-xs">({ago(r.first_connected_at, now)})</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>{status}</span>
                          {r.last_seen_at ? (
                            <span className="ml-2 text-xs text-muted-foreground">{ago(r.last_seen_at, now)}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{r.request_count.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="p-6 text-sm text-muted-foreground">No customer connections recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {includeDemo ? (
          <>
            Demo and test accounts are included.{" "}
            <Link href="/admin/connections" className="underline underline-offset-2 hover:text-foreground">
              Hide them
            </Link>
            .
          </>
        ) : (
          <>
            Demo and test accounts are left out
            {hiddenDemo ? ` (${hiddenDemo} hidden)` : ""}.{" "}
            <Link href="/admin/connections?demo=1" className="underline underline-offset-2 hover:text-foreground">
              Show them
            </Link>
            .
          </>
        )}{" "}
        Active means used in the last 7 days, Quiet 8 to 30 days, Dormant longer. Requests include the connection
        handshake and tool listing, not only questions asked. A connection made before migration 0088 shows as Other
        until it next calls.
      </p>
    </div>
  );
}
