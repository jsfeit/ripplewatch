import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AUDIT_LABELS, AUDIT_RETENTION_MONTHS } from "@/lib/audit";
import { loadAuditLog } from "@/lib/audit-read";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Audit log" };

const WHEN = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default async function AuditLogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const log = await loadAuditLog(user.id, 200);

  if (log.state !== "ok") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-10">
        <Card>
          <CardHeader>
            <h1 className="text-xl font-semibold tracking-tight">Audit log</h1>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              {log.state === "not-owner"
                ? "Only the account owner, the person who set up and pays for this account, can see the audit log."
                : "There's no account to show a log for yet."}
            </p>
            <Link href="/app/settings" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Back to settings
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-10">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Audit log</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Who did what on {log.accountName}. Shown to the account owner only, kept for {AUDIT_RETENTION_MONTHS}{" "}
                months, times in UTC. Showing the latest {log.rows.length}.
              </p>
            </div>
            <div className="flex gap-2">
              <a href="/api/settings/audit-log/export" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Download CSV
              </a>
              <Link href="/app/settings" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Back
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {log.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing recorded yet. Connecting an assistant, creating an API key, inviting a teammate and changes to
              your competitors and deals will show up here.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">When</th>
                    <th className="px-4 py-2.5 font-medium">Who</th>
                    <th className="px-4 py-2.5 font-medium">What</th>
                    <th className="px-4 py-2.5 font-medium">Target</th>
                    <th className="px-4 py-2.5 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {log.rows.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{WHEN.format(new Date(r.created_at))}</td>
                      <td className="px-4 py-2.5">
                        {r.actor_label ?? "Ripplewatch"}
                        {r.actor_type === "assistant" ? <span className="ml-1.5 text-xs text-muted-foreground">(assistant)</span> : null}
                      </td>
                      <td className="px-4 py-2.5">{AUDIT_LABELS[r.action as keyof typeof AUDIT_LABELS] ?? r.action}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.target ?? ""}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.ip ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
