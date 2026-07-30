import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { SupabaseNotConfigured } from "@/components/admin/not-configured";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SIGNAL_TYPE_LABELS } from "@/lib/mock-data";
import { EvalLabelControl } from "@/components/admin/eval-label-control";

export const metadata = { title: "Signals — Admin" };
export const dynamic = "force-dynamic";

const LEVEL_BADGE: Record<string, string> = {
  High: "border-primary/30 text-primary",
  Medium: "border-amber-500/30 text-amber-700 dark:text-amber-400",
  Low: "border-border text-muted-foreground",
};

type Row = {
  id: string;
  title: string;
  type: string;
  occurredOn: string;
  scored: boolean;
  relevanceLevel: string | null;
  delivered: boolean;
  competitorName: string;
  accountId: string | null;
  accountName: string | null;
  evalLabel: "correct" | "incorrect" | null;
};

export default async function AdminSignalsPage() {
  const configured = isSupabaseConfigured();
  let rows: Row[] = [];
  let error: string | null = null;

  if (configured) {
    const supabase = createAdminClient();

    const [{ data: signals, error: signalsError }, { data: competitors }, { data: accounts }, { data: evalLabels }] =
      await Promise.all([
        supabase
          .from("signals")
          .select("*")
          .order("occurred_on", { ascending: false })
          .limit(300),
        supabase.from("competitors").select("id, name, account_id"),
        supabase.from("accounts").select("id, name"),
        supabase.from("signal_eval_labels").select("signal_id, label"),
      ]);

    if (signalsError) {
      error = signalsError.message;
    } else {
      const competitorById = new Map((competitors ?? []).map((c) => [c.id, c]));
      const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));
      const evalLabelBySignalId = new Map((evalLabels ?? []).map((l) => [l.signal_id, l.label]));

      rows = (signals ?? []).map((s) => {
        const competitor = competitorById.get(s.competitor_id);
        const account = competitor?.account_id ? accountById.get(competitor.account_id) : undefined;
        return {
          id: s.id,
          title: s.title,
          type: s.type,
          occurredOn: s.occurred_on,
          scored: s.scored,
          relevanceLevel: s.relevance_level,
          delivered: Boolean(s.slack_sent_at || s.email_digest_sent_at),
          competitorName: competitor?.name ?? "Unknown competitor",
          accountId: account?.id ?? null,
          accountName: account?.name ?? null,
          evalLabel: evalLabelBySignalId.get(s.id) ?? null,
        };
      });
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Signals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length} signal{rows.length === 1 ? "" : "s"} across every account, most recent first.
        </p>
      </div>

      {!configured ? (
        <SupabaseNotConfigured />
      ) : error ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Couldn&apos;t load signals: {error}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Competitor</TableHead>
                <TableHead>Signal</TableHead>
                <TableHead>Relevance</TableHead>
                <TableHead>Eval</TableHead>
                <TableHead>Delivered</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.accountId ? (
                      <Link href={`/admin/accounts/${row.accountId}`} className="text-primary hover:underline">
                        {row.accountName ?? "Unnamed account"}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.competitorName}</TableCell>
                  <TableCell>
                    <p className="font-medium">{row.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {SIGNAL_TYPE_LABELS[row.type as keyof typeof SIGNAL_TYPE_LABELS] ?? row.type}
                    </p>
                  </TableCell>
                  <TableCell>
                    {row.scored && row.relevanceLevel ? (
                      <Badge variant="outline" className={LEVEL_BADGE[row.relevanceLevel]}>
                        {row.relevanceLevel}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Raw</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.scored ? (
                      <EvalLabelControl signalId={row.id} initialLabel={row.evalLabel} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.delivered ? (
                      <Badge variant="outline" className="text-primary">
                        Sent
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not yet</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(row.occurredOn).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No signals yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
