import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { SupabaseNotConfigured } from "@/components/admin/not-configured";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Waitlist — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminWaitlistPage() {
  const configured = isSupabaseConfigured();
  const { data: signups, error } = configured
    ? await createAdminClient()
        .from("waitlist_signups")
        .select("*")
        .order("created_at", { ascending: false })
    : { data: null, error: null };

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Waitlist</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {signups?.length ?? 0} signup{signups?.length === 1 ? "" : "s"}
        </p>
      </div>

      {!configured ? (
        <SupabaseNotConfigured />
      ) : error ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Couldn&apos;t load the waitlist: {error.message}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signups?.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.email}</TableCell>
                  <TableCell className="text-muted-foreground">{s.company_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              {signups?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No signups yet.
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
