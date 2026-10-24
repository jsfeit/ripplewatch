import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSISTANTS } from "@/lib/mcp-attribution";

export const metadata = { title: "AI connections | Admin" };
export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

function nowMs(): number {
  return Date.now();
}

function ago(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((nowMs() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  if (mins < 60 * 48) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

const LABEL: Record<string, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
  cursor: "Cursor",
  glama: "Glama (directory checker)",
  other: "Other",
  unknown: "Unknown",
};

export default async function AdminConnectionsPage() {
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

  const rows = data ?? [];
  const accountIds = [...new Set(rows.map((r) => r.account_id))];
  const { data: accounts } = accountIds.length
    ? await admin.from("accounts").select("id, name, status, demo_mode").in("id", accountIds)
    : { data: [] };
  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));

  // Demo accounts (directory reviewers, Glama's health check) aren't customers, so they stay out of the
  // headline counts but remain in the table.
  const real = rows.filter((r) => !accountById.get(r.account_id)?.demo_mode);
  const now = nowMs();
  const byAssistant = [...ASSISTANTS].map((a) => {
    const mine = real.filter((r) => r.assistant === a);
    return {
      assistant: a,
      accounts: new Set(mine.map((r) => r.account_id)).size,
      active7d: new Set(mine.filter((r) => r.last_seen_at && now - new Date(r.last_seen_at).getTime() < 7 * DAY).map((r) => r.account_id)).size,
      requests: mine.reduce((sum, r) => sum + r.request_count, 0),
    };
  }).filter((a) => a.accounts > 0);

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">AI connections</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Which assistant each account connected, and how much it&apos;s used. Recorded when someone approves the connection;
          a connection made before 0088 shows as Unknown until it next calls. Demo accounts are left out of the counts.
          Requests include the handshake and tool listing, not only tool calls.
        </p>
      </div>

      {byAssistant.length ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {byAssistant.map((a) => (
            <Card key={a.assistant}>
              <CardHeader>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{LABEL[a.assistant]}</p>
                <p className="text-2xl font-semibold tabular-nums">{a.accounts}</p>
              </CardHeader>
              <CardContent className="space-y-0.5 text-xs text-muted-foreground">
                <p>{a.active7d} active in the last 7 days</p>
                <p>{a.requests.toLocaleString()} requests</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="mb-6 rounded-md border border-border bg-secondary/40 p-4 text-sm">No customer connections recorded yet.</p>
      )}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Assistant</th>
                <th className="px-4 py-2 font-medium">Account</th>
                <th className="px-4 py-2 font-medium">Client name</th>
                <th className="px-4 py-2 font-medium">Redirects to</th>
                <th className="px-4 py-2 font-medium">Connected</th>
                <th className="px-4 py-2 font-medium">Last seen</th>
                <th className="px-4 py-2 text-right font-medium">Requests</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const account = accountById.get(r.account_id);
                return (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 font-medium">{LABEL[r.assistant] ?? r.assistant}</td>
                    <td className="px-4 py-3">
                      {account?.name ?? "-"}
                      {account?.demo_mode ? <span className="ml-1.5 text-xs text-muted-foreground">demo</span> : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.client_name ?? "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.redirect_host ?? "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{ago(r.first_connected_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{ago(r.last_seen_at)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.request_count.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
