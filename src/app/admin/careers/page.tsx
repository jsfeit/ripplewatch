import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { SupabaseNotConfigured } from "@/components/admin/not-configured";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { Download } from "lucide-react";

export const metadata = { title: "Careers — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminCareersPage() {
  const configured = isSupabaseConfigured();

  let applications: {
    id: string;
    name: string;
    email: string;
    job_title: string;
    resume_file_name: string;
    created_at: string;
    resumeUrl: string | null;
  }[] = [];
  let error: string | null = null;

  if (configured) {
    const supabase = createAdminClient();
    const { data, error: queryError } = await supabase
      .from("career_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (queryError) {
      error = queryError.message;
    } else {
      applications = await Promise.all(
        (data ?? []).map(async (app) => {
          const { data: signed } = await supabase.storage
            .from("career-resumes")
            .createSignedUrl(app.resume_storage_path, 60 * 60);
          return { ...app, resumeUrl: signed?.signedUrl ?? null };
        })
      );
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Careers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {applications.length} application{applications.length === 1 ? "" : "s"} from /careers
        </p>
      </div>

      {!configured ? (
        <SupabaseNotConfigured />
      ) : error ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Couldn&apos;t load applications: {error}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role wanted</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Resume</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell className="font-medium">{app.name}</TableCell>
                  <TableCell className="text-muted-foreground">{app.email}</TableCell>
                  <TableCell className="text-muted-foreground">{app.job_title}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(app.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {app.resumeUrl ? (
                      <a
                        href={app.resumeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <Download className="size-3.5" />
                        {app.resume_file_name}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unavailable</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {applications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
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
