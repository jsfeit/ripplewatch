import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { SupabaseNotConfigured } from "@/components/admin/not-configured";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Database } from "@/lib/supabase/types";

export const metadata = { title: "Accounts — Admin" };
export const dynamic = "force-dynamic";

const TIER_LABELS: Record<string, string> = {
  starter: "Starter",
  plus: "Plus",
  plus_human: "Plus + Human",
};

type Account = Database["public"]["Tables"]["accounts"]["Row"];

export default async function AdminAccountsPage() {
  const configured = isSupabaseConfigured();
  const competitorCounts = new Map<string, number>();
  let accounts: Account[] | null = null;
  let error: { message: string } | null = null;

  if (configured) {
    const supabase = createAdminClient();
    const accountsResult = await supabase.from("accounts").select("*").order("created_at", { ascending: false });
    accounts = accountsResult.data;
    error = accountsResult.error;

    const { data: competitorRows } = await supabase.from("competitors").select("account_id");
    for (const row of competitorRows ?? []) {
      competitorCounts.set(row.account_id, (competitorCounts.get(row.account_id) ?? 0) + 1);
    }
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
                  <TableCell className="text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              {accounts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
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
