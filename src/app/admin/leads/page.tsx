import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { SupabaseNotConfigured } from "@/components/admin/not-configured";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Leads | Admin" };
export const dynamic = "force-dynamic";

const CAPTURE_POINT_LABELS: Record<string, string> = {
  onboarding: "Onboarding",
  quiz: "Quiz",
};

export default async function AdminLeadsPage() {
  const configured = isSupabaseConfigured();
  const { data: leads, error } = configured
    ? await createAdminClient()
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
    : { data: null, error: null };

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {leads?.length ?? 0} email{leads?.length === 1 ? "" : "s"} captured across onboarding&apos;s first step
          and the competitive-intel quiz, before payment or account creation. Use this list to retarget anyone
          who didn&apos;t finish signing up.
        </p>
      </div>

      {!configured ? (
        <SupabaseNotConfigured />
      ) : error ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Couldn&apos;t load leads: {error.message}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Captured via</TableHead>
                <TableHead>UTM source</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads?.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.email}</TableCell>
                  <TableCell className="text-muted-foreground">{l.company_name ?? "–"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.capture_point ? (CAPTURE_POINT_LABELS[l.capture_point] ?? l.capture_point) : "–"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.utm_source
                      ? [l.utm_source, l.utm_medium, l.utm_campaign].filter(Boolean).join(" / ")
                      : "–"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(l.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              {leads?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No leads yet.
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
