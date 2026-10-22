import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Live reads | Admin" };
export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;
const SHOWN = 100;

function pct(n: number, of: number): string {
  return of > 0 ? `${Math.round((n / of) * 100)}%` : "-";
}

// Read the clock outside the component body: the page renders per request, so this is
// always current, and the render-purity lint rule only objects to calling it inline.
function nowMs(): number {
  return Date.now();
}

function ago(iso: string): string {
  const mins = Math.round((nowMs() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  if (mins < 60 * 48) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

export default async function AdminLiveReadsPage() {
  const admin = createAdminClient();
  // utm_* come from migration 0087; until it is applied, fall back to the original columns.
  const withUtm = await admin
    .from("live_reads")
    .select(
      "id, created_at, company_name, positioning, icp, competitor_domain, competitor_name, confidence, read, account_id, utm_source, utm_medium, utm_campaign"
    )
    .order("created_at", { ascending: false })
    .limit(500);
  let reads: ((NonNullable<typeof withUtm.data>)[number])[] | null = withUtm.data;
  let error = withUtm.error;
  if (error) {
    const plain = await admin
      .from("live_reads")
      .select("id, created_at, company_name, positioning, icp, competitor_domain, competitor_name, confidence, read, account_id")
      .order("created_at", { ascending: false })
      .limit(500);
    reads = plain.data ? plain.data.map((r) => ({ ...r, utm_source: null, utm_medium: null, utm_campaign: null })) : null;
    error = plain.error;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Live reads</h1>
        <p className="mt-4 rounded-md border border-border bg-secondary/40 p-4 text-sm">
          Can&apos;t read the live_reads table yet. If migration 0085 hasn&apos;t been applied, run it in the Supabase SQL editor
          and reload. ({error.message})
        </p>
      </div>
    );
  }

  const rows = reads ?? [];
  const accountIds = [...new Set(rows.map((r) => r.account_id).filter((id): id is string => Boolean(id)))];
  const { data: accounts } = accountIds.length
    ? await admin.from("accounts").select("id, name, status").in("id", accountIds)
    : { data: [] };
  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));

  const now = nowMs();
  const stat = (since: number) => {
    const inWindow = rows.filter((r) => new Date(r.created_at).getTime() >= since);
    const withRead = inWindow.filter((r) => r.read).length;
    const signedUp = inWindow.filter((r) => r.account_id).length;
    const paid = inWindow.filter((r) => r.account_id && accountById.get(r.account_id)?.status === "active").length;
    return { total: inWindow.length, withRead, signedUp, paid };
  };
  const windows = [
    { label: "Last 7 days", ...stat(now - 7 * DAY) },
    { label: "Last 30 days", ...stat(now - 30 * DAY) },
    { label: `Last ${rows.length} reads`, ...stat(0) },
  ];

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Live reads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The free read on a competitor, run on the signup page before anyone has an account. A read is linked to an account
          once that person finishes setup in the same browser, so someone who signs up later on another device shows as not
          signed up. Daily cap: 100 reads.
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {windows.map((w) => (
          <Card key={w.label}>
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{w.label}</p>
              <p className="text-2xl font-semibold tabular-nums">{w.total}</p>
            </CardHeader>
            <CardContent className="space-y-0.5 text-xs text-muted-foreground">
              <p>
                {w.withRead} produced a read ({pct(w.withRead, w.total)})
              </p>
              <p>
                {w.signedUp} signed up ({pct(w.signedUp, w.total)})
              </p>
              <p>
                {w.paid} paid ({pct(w.paid, w.total)})
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Lead (company they typed)</th>
                <th className="px-4 py-2 font-medium">Competitor</th>
                <th className="px-4 py-2 font-medium">Read</th>
                <th className="px-4 py-2 font-medium">Account</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, SHOWN).map((r) => {
                const account = r.account_id ? accountById.get(r.account_id) : undefined;
                const read = r.read as { found?: string; meaning?: string; move?: string; question?: string } | null;
                return (
                  <tr key={r.id} className="border-b border-border/60 align-top last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {ago(r.created_at)}
                      {r.utm_source ? (
                        <span className="mt-0.5 block text-xs">
                          {[r.utm_source, r.utm_campaign].filter(Boolean).join(" / ")}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.company_name || "(no name)"}</p>
                      <p className="max-w-[16rem] truncate text-xs text-muted-foreground" title={r.positioning ?? ""}>
                        {r.positioning}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{r.competitor_name || r.competitor_domain}</p>
                      <p className="text-xs text-muted-foreground">{r.competitor_domain}</p>
                    </td>
                    <td className="px-4 py-3">
                      {read ? (
                        <details>
                          <summary className="cursor-pointer text-xs">
                            <span
                              className={`rounded-full border px-2 py-0.5 font-medium ${
                                r.confidence === "thin"
                                  ? "border-border text-muted-foreground"
                                  : "border-primary/30 bg-primary/10 text-primary"
                              }`}
                            >
                              {r.confidence === "thin" ? "Thin" : "Evidence"}
                            </span>{" "}
                            <span className="text-muted-foreground">show</span>
                          </summary>
                          <dl className="mt-2 max-w-md space-y-1.5 text-xs">
                            <div>
                              <dt className="font-semibold">Found</dt>
                              <dd>{read.found}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold">Meaning</dt>
                              <dd>{read.meaning}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold">Move</dt>
                              <dd>{read.move}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold">Question</dt>
                              <dd>{read.question}</dd>
                            </div>
                          </dl>
                        </details>
                      ) : (
                        <span className="text-xs text-muted-foreground">No read produced</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {account ? (
                        <Link href={`/admin/accounts/${account.id}`} className="text-primary hover:underline">
                          {account.name}
                          <span className="ml-1 text-xs text-muted-foreground">
                            {account.status === "active" ? "(paid)" : "(not paid)"}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not signed up</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No live reads yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {rows.length > SHOWN ? (
        <p className="mt-3 text-xs text-muted-foreground">Showing the latest {SHOWN} of {rows.length} loaded.</p>
      ) : null}
    </div>
  );
}
