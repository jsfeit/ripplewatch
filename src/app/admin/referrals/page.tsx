import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { SupabaseNotConfigured } from "@/components/admin/not-configured";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildOrdinalMap } from "@/lib/admin-numbering";

export const metadata = { title: "Referrals | Admin" };
export const dynamic = "force-dynamic";

export default async function AdminReferralsPage() {
  const configured = isSupabaseConfigured();
  const supabase = configured ? createAdminClient() : null;

  const { data: referrals, error } = supabase
    ? await supabase.from("referrals").select("*").order("referred_at", { ascending: false })
    : { data: null, error: null };

  // Two FKs from referrals -> accounts (referrer + referred) means
  // PostgREST can't auto-embed either side unambiguously — simpler and
  // more robust to fetch both account sets separately and join in JS.
  const accountIds = Array.from(
    new Set((referrals ?? []).flatMap((r) => [r.referrer_account_id, r.referred_account_id]))
  );
  const { data: accounts } = supabase && accountIds.length
    ? await supabase.from("accounts").select("id, name, contact_email").in("id", accountIds)
    : { data: [] };
  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));
  const referralNumbers = buildOrdinalMap(referrals ?? [], (r) => r.id, (r) => r.referred_at);

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Referrals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {referrals?.length ?? 0} referral{referrals?.length === 1 ? "" : "s"} tracked. Qualified means the
          referred account stayed active/paying for 60 days and the referrer&apos;s reward was granted.
        </p>
      </div>

      {!configured ? (
        <SupabaseNotConfigured />
      ) : error ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Couldn&apos;t load referrals: {error.message}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Referrer</TableHead>
                <TableHead>Referred</TableHead>
                <TableHead>Referred at</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referrals?.map((r) => {
                const referrer = accountById.get(r.referrer_account_id);
                const referred = accountById.get(r.referred_account_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground tabular-nums">#{referralNumbers.get(r.id)}</TableCell>
                    <TableCell className="font-medium">{referrer?.name ?? r.referrer_account_id}</TableCell>
                    <TableCell className="text-muted-foreground">{referred?.name ?? r.referred_account_id}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(r.referred_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {r.qualified_at ? (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          Qualified {new Date(r.qualified_at).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                          Pending
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {referrals?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No referrals yet.
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
