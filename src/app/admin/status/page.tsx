import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getSystemStatus } from "@/lib/system-status";

export const metadata = { title: "System status — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminStatusPage() {
  const checks = await getSystemStatus();

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">System status</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live checks against every integration this app depends on — run this after switching
          between test/sandbox and live keys to confirm the current environment is fully wired up.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-medium">Integrations</h2>
        </CardHeader>
        <CardContent className="space-y-2">
          {checks.map((check) => (
            <div
              key={check.name}
              className="flex items-start justify-between gap-4 rounded-lg border border-border p-4"
            >
              <div className="flex items-start gap-3">
                {check.ok ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
                ) : check.configured ? (
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
                ) : (
                  <XCircle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">{check.name}</p>
                  <p className="text-xs text-muted-foreground">{check.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
