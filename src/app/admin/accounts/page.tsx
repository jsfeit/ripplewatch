import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { SupabaseNotConfigured } from "@/components/admin/not-configured";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Database } from "@/lib/supabase/types";
import { sumLlmUsageByAccount } from "@/lib/llm-pricing";
import { TIERS } from "@/lib/tiers";

export const metadata = { title: "Accounts — Admin" };
export const dynamic = "force-dynamic";

const TIER_LABELS: Record<string, string> = {
  starter: "Starter",
  plus: "Plus",
  advanced: "Advanced",
};

const MONTHLY_USD_BY_TIER: Record<string, number> = Object.fromEntries(TIERS.map((t) => [t.id, t.monthlyUsd]));

const LLM_COST_WINDOW_DAYS = 30;

type Account = Database["public"]["Tables"]["accounts"]["Row"];

export default async function AdminAccountsPage() {
  const configured = isSupabaseConfigured();
  const competitorCounts = new Map<string, number>();
  const userCounts = new Map<string, number>();
  let accounts: Account[] | null = null;
  let error: { message: string } | null = null;
  let llmCostByAccount = new Map<string, { tokens: number; costUsd: number; calls: number }>();

  if (configured) {
    const supabase = createAdminClient();
    const accountsResult = await supabase.from("accounts").select("*").order("created_at", { ascending: false });
    accounts = accountsResult.data;
    error = accountsResult.error;

    const { data: competitorRows } = await supabase.from("competitors").select("account_id");
    for (const row of competitorRows ?? []) {
      competitorCounts.set(row.account_id, (competitorCounts.get(row.account_id) ?? 0) + 1);
    }

    const { data: profileRows } = await supabase.from("profiles").select("account_id");
    for (const row of profileRows ?? []) {
      if (!row.account_id) continue;
      userCounts.set(row.account_id, (userCounts.get(row.account_id) ?? 0) + 1);
    }

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - LLM_COST_WINDOW_DAYS);
    const { data: usageRows } = await supabase
      .from("llm_usage")
      .select("account_id, function_name, model, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens")
      .gte("created_at", since.toISOString());
    llmCostByAccount = sumLlmUsageByAccount(usageRows ?? []);
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {accounts?.length ?? 0} account{accounts?.length === 1 ? "" : "s"} — click one to manage its
          competitors and signals.
        </p>
      </div>

      {!configured ? (
        <SupabaseNotConfigured />
      ) : error ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Couldn&apos;t load accounts: {error.message}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Competitors</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>LLM cost (30d)</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts?.map((a) => (
                <TableRow key={a.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link href={`/admin/accounts/${a.id}`} className="hover:underline">
                      {a.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{TIER_LABELS[a.tier] ?? a.tier}</Badge>
                  </TableCell>
                  <TableCell>
                    {!a.subscription_status ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : ["active", "trialing"].includes(a.subscription_status) ? (
                      <Badge variant="outline" className="text-primary">
                        {a.subscription_status}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-destructive/40 text-destructive">
                        {a.subscription_status.replace("_", " ")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {competitorCounts.get(a.id) ?? 0}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{userCounts.get(a.id) ?? 0}</TableCell>
                  <TableCell>
                    {(() => {
                      const usage = llmCostByAccount.get(a.id);
                      if (!usage || usage.calls === 0) {
                        return <span className="text-xs text-muted-foreground">—</span>;
                      }
                      const tierPrice = MONTHLY_USD_BY_TIER[a.tier];
                      const overTierPrice = tierPrice !== undefined && usage.costUsd > tierPrice;
                      return (
                        <div className="flex items-center gap-1.5">
                          <span className={overTierPrice ? "font-medium text-destructive" : ""}>
                            ${usage.costUsd.toFixed(2)}
                          </span>
                          {overTierPrice ? (
                            <Badge variant="outline" className="border-destructive/40 text-destructive">
                              over tier price
                            </Badge>
                          ) : null}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              {accounts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No accounts yet.
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
