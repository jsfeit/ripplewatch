import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { SupabaseNotConfigured } from "@/components/admin/not-configured";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SIGNAL_TYPE_LABELS } from "@/lib/mock-data";
import { EvalLabelControl } from "@/components/admin/eval-label-control";

export const metadata = { title: "Signals | Admin" };
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
  relevanceScore: number | null;
  delivered: boolean;
  competitorName: string;
  accountId: string | null;
  accountName: string | null;
  evalLabel: "correct" | "incorrect" | null;
};

type LevelAccuracy = { level: string; labeled: number; correct: number };

function computeAccuracy(rows: Row[]): { totalLabeled: number; totalCorrect: number; byLevel: LevelAccuracy[] } {
  const labeled = rows.filter((r) => r.evalLabel !== null);
  const byLevelMap = new Map<string, LevelAccuracy>();
  for (const row of labeled) {
    const level = row.relevanceLevel ?? "Unknown";
    const entry = byLevelMap.get(level) ?? { level, labeled: 0, correct: 0 };
    entry.labeled += 1;
    if (row.evalLabel === "correct") entry.correct += 1;
    byLevelMap.set(level, entry);
  }
  return {
    totalLabeled: labeled.length,
    totalCorrect: labeled.filter((r) => r.evalLabel === "correct").length,
    byLevel: Array.from(byLevelMap.values()).sort((a, b) => a.level.localeCompare(b.level)),
  };
}

type StuckAccount = { accountId: string; accountName: string; count: number };

export default async function AdminSignalsPage() {
  const configured = isSupabaseConfigured();
  let rows: Row[] = [];
  let error: string | null = null;
  let stuckAccounts: StuckAccount[] = [];

  if (configured) {
    const supabase = createAdminClient();
    const oneDayAgoDate = new Date();
    oneDayAgoDate.setUTCDate(oneDayAgoDate.getUTCDate() - 1);
    const oneDayAgo = oneDayAgoDate.toISOString();

    const [
      { data: signals, error: signalsError },
      { data: competitors },
      { data: accounts },
      { data: evalLabels },
      { data: staleUnscored },
    ] = await Promise.all([
      supabase
        .from("signals")
        .select("*")
        .order("occurred_on", { ascending: false })
        .limit(300),
      supabase.from("competitors").select("id, name, account_id"),
      supabase.from("accounts").select("id, name, tier"),
      supabase.from("signal_eval_labels").select("signal_id, label"),
      // Every crawl now rescues its own account's backlog (see
      // runCrawlForAccount in crawl.ts), so this should normally read
      // empty — a nonzero count here means something is scoring-failing
      // faster than the crawl's rescue can keep up, worth a look rather
      // than relying on someone noticing bad-looking dashboard data.
      // Starter is excluded: its unscored backlog is the teaser design,
      // not a failure.
      supabase.from("signals").select("id, competitor_id").eq("scored", false).lt("created_at", oneDayAgo),
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
          relevanceScore: s.relevance_score,
          delivered: Boolean(s.slack_sent_at || s.email_digest_sent_at),
          competitorName: competitor?.name ?? "Unknown competitor",
          accountId: account?.id ?? null,
          accountName: account?.name ?? null,
          evalLabel: evalLabelBySignalId.get(s.id) ?? null,
        };
      });

      const stuckByAccount = new Map<string, StuckAccount>();
      for (const s of staleUnscored ?? []) {
        const competitor = competitorById.get(s.competitor_id);
        const account = competitor?.account_id ? accountById.get(competitor.account_id) : undefined;
        if (!account || account.tier === "starter") continue;
        const entry = stuckByAccount.get(account.id) ?? { accountId: account.id, accountName: account.name, count: 0 };
        entry.count += 1;
        stuckByAccount.set(account.id, entry);
      }
      stuckAccounts = Array.from(stuckByAccount.values()).sort((a, b) => b.count - a.count);
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
        <>
          <StuckBacklogAlert accounts={stuckAccounts} />
          <AccuracyStats accuracy={computeAccuracy(rows)} />
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
                      <span className="text-xs text-muted-foreground">–</span>
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
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={LEVEL_BADGE[row.relevanceLevel]}>
                          {row.relevanceLevel}
                        </Badge>
                        {row.relevanceScore !== null ? (
                          <span className="text-xs text-muted-foreground">{row.relevanceScore}</span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Raw</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.scored ? (
                      <EvalLabelControl signalId={row.id} initialLabel={row.evalLabel} />
                    ) : (
                      <span className="text-xs text-muted-foreground">–</span>
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
        </>
      )}
    </div>
  );
}

function StuckBacklogAlert({ accounts }: { accounts: StuckAccount[] }) {
  if (accounts.length === 0) return null;

  const total = accounts.reduce((sum, a) => sum + a.count, 0);

  return (
    <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-400">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <p>
        {total} signal{total === 1 ? "" : "s"} across {accounts.length} account{accounts.length === 1 ? "" : "s"}{" "}
        {accounts.length === 1 ? "has" : "have"} sat unscored for over 24h. The crawl&apos;s own backlog rescue
        should normally clear this, so a nonzero count here suggests scoring is failing faster than it recovers:{" "}
        {accounts.map((a, i) => (
          <span key={a.accountId}>
            {i > 0 ? ", " : ""}
            <Link href={`/admin/accounts/${a.accountId}`} className="underline">
              {a.accountName}
            </Link>{" "}
            ({a.count})
          </span>
        ))}
      </p>
    </div>
  );
}

function AccuracyStats({
  accuracy,
}: {
  accuracy: { totalLabeled: number; totalCorrect: number; byLevel: LevelAccuracy[] };
}) {
  if (accuracy.totalLabeled === 0) {
    return (
      <p className="mb-6 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        No signals labeled yet; use the thumbs up/down in the Eval column below to start building an accuracy
        baseline for the scoring prompt.
      </p>
    );
  }

  const overallPct = Math.round((accuracy.totalCorrect / accuracy.totalLabeled) * 100);

  return (
    <div className="mb-6 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className="text-sm">
          Scoring accuracy: <span className="font-semibold">{overallPct}%</span>{" "}
          <span className="text-muted-foreground">
            ({accuracy.totalCorrect}/{accuracy.totalLabeled} labeled signals marked correct)
          </span>
        </p>
      </div>
      {accuracy.byLevel.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          {accuracy.byLevel.map((l) => (
            <span key={l.level}>
              {l.level}: {Math.round((l.correct / l.labeled) * 100)}% ({l.correct}/{l.labeled})
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
