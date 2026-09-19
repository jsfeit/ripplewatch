import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { SupabaseNotConfigured } from "@/components/admin/not-configured";
import { Badge } from "@/components/ui/badge";
import { daysAgoIso, summarizeActivity, topFeatures, relativeTime, type ActivityRow } from "@/lib/activity";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Users | Admin" };
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  email: string;
  lastSignInAt: string | null;
  signedUpAt: string | null;
  loginCount: number;
  lastActiveAt: string | null;
  topUsed: [string, number][];
  role: string | null;
  accountId: string | null;
  accountName: string | null;
};

export default async function AdminUsersPage() {
  const configured = isSupabaseConfigured();
  let rows: Row[] = [];
  let error: string | null = null;

  if (configured) {
    const supabase = createAdminClient();

    const { data: userList, error: listError } = await supabase.auth.admin.listUsers({ perPage: 200 });
    if (listError) {
      error = listError.message;
    } else {
      const { data: profiles } = await supabase.from("profiles").select("id, account_id, role");
      const { data: accounts } = await supabase.from("accounts").select("id, name");

      const { data: activityRows } = await supabase
        .from("user_activity")
        .select("user_id, kind, path, created_at")
        .gte("created_at", daysAgoIso(30))
        .limit(50_000);
      const activity = summarizeActivity((activityRows ?? []) as ActivityRow[]);
      // Login counts aren't windowed: fetched separately so "logins" is the
      // all-time number, while feature usage stays a 30-day view.
      const { data: loginRows } = await supabase.from("user_activity").select("user_id").eq("kind", "login").limit(50_000);
      const loginCounts = new Map<string, number>();
      for (const r of loginRows ?? []) loginCounts.set(r.user_id, (loginCounts.get(r.user_id) ?? 0) + 1);

      const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
      const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));

      rows = userList.users
        .map((u) => {
          const profile = profileById.get(u.id);
          const account = profile?.account_id ? accountById.get(profile.account_id) : undefined;
          return {
            id: u.id,
            email: u.email ?? "–",
            lastSignInAt: u.last_sign_in_at ?? null,
            signedUpAt: u.created_at ?? null,
            loginCount: loginCounts.get(u.id) ?? 0,
            lastActiveAt: activity.get(u.id)?.lastActiveAt ?? null,
            topUsed: topFeatures(activity.get(u.id)?.features ?? {}),
            role: profile?.role ?? null,
            accountId: account?.id ?? null,
            accountName: account?.name ?? null,
          };
        })
        .sort((a, b) => {
          if (!a.lastSignInAt && !b.lastSignInAt) return 0;
          if (!a.lastSignInAt) return 1;
          if (!b.lastSignInAt) return -1;
          return new Date(b.lastSignInAt).getTime() - new Date(a.lastSignInAt).getTime();
        });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length} user{rows.length === 1 ? "" : "s"} across every account. Sign-in counts and usage start from when tracking
          went live; sign-up and last login come from the auth records.
        </p>
      </div>

      {!configured ? (
        <SupabaseNotConfigured />
      ) : error ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Couldn&apos;t load users: {error}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Signed up</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead>Logins</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead>Uses most (30d)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.email}</TableCell>
                  <TableCell>
                    {row.accountId ? (
                      <Link href={`/admin/accounts/${row.accountId}`} className="text-primary hover:underline">
                        {row.accountName ?? "Unnamed account"}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">No account</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.role ? (
                      <Badge variant="secondary" className="capitalize">
                        {row.role}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">–</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.signedUpAt ? new Date(row.signedUpAt).toLocaleDateString() : "–"}
                  </TableCell>
                  <TableCell className="text-muted-foreground" title={row.lastSignInAt ? new Date(row.lastSignInAt).toLocaleString() : undefined}>
                    {relativeTime(row.lastSignInAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{row.loginCount || "–"}</TableCell>
                  <TableCell className="text-muted-foreground" title={row.lastActiveAt ? new Date(row.lastActiveAt).toLocaleString() : undefined}>
                    {row.lastActiveAt ? relativeTime(row.lastActiveAt) : "–"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.topUsed.length > 0 ? row.topUsed.map(([f, n]) => `${f} (${n})`).join(", ") : "–"}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No users yet.
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
