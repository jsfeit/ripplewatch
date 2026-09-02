import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { SupabaseNotConfigured } from "@/components/admin/not-configured";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AffiliateStatusSelect } from "@/components/admin/affiliate-status-select";

export const metadata = { title: "Affiliates | Admin" };
export const dynamic = "force-dynamic";

export default async function AdminAffiliatesPage() {
  const configured = isSupabaseConfigured();
  const { data: applications, error } = configured
    ? await createAdminClient()
        .from("affiliate_applications")
        .select("*")
        .order("created_at", { ascending: false })
    : { data: null, error: null };

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Affiliates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {applications?.length ?? 0} application{applications?.length === 1 ? "" : "s"} submitted via
          /affiliates. Lead-capture only; update status here as you follow up.
        </p>
      </div>

      {!configured ? (
        <SupabaseNotConfigured />
      ) : error ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Couldn&apos;t load applications: {error.message}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Why good fit</TableHead>
                <TableHead>Channels</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications?.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="text-muted-foreground">{a.email}</TableCell>
                  <TableCell className="max-w-xs text-muted-foreground">{a.why_good_fit}</TableCell>
                  <TableCell className="max-w-xs text-muted-foreground">{a.channels}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <AffiliateStatusSelect id={a.id} initialStatus={a.status} />
                  </TableCell>
                </TableRow>
              ))}
              {applications?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No applications yet.
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
