import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getConnectFunnel } from "@/lib/connect-funnel";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Signup funnel | Admin" };
export const dynamic = "force-dynamic";

const WINDOWS: { value: string; days: number | null; label: string }[] = [
  { value: "7", days: 7, label: "Last 7 days" },
  { value: "30", days: 30, label: "Last 30 days" },
  { value: "all", days: null, label: "All time" },
];

function pct(n: number, of: number): string {
  return of > 0 ? `${Math.round((n / of) * 100)}%` : "-";
}

export default async function AdminFunnelPage({ searchParams }: { searchParams: Promise<{ window?: string }> }) {
  const params = await searchParams;
  const selected = WINDOWS.find((w) => w.value === params.window) ?? WINDOWS[1];
  // Whoever is looking at this page is the one who made the test signups, so their
  // plus-address aliases (you+test@...) are left out along with the admin emails.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const funnel = await getConnectFunnel(selected.days, user?.email ? [user.email] : []);
  const top = funnel.stages[0]?.count ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Signup funnel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ripplewatch Connect, read from the accounts themselves. Each person who signed up in the window is followed
          through the stages below. Your own emails and their plus-address aliases are left out.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        {WINDOWS.map((w) => (
          <Link
            key={w.value}
            href={`/admin/funnel?window=${w.value}`}
            className={`rounded-full border px-3 py-1 text-sm ${
              w.value === selected.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {w.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-medium">{selected.label}</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          {funnel.stages.map((stage, i) => {
            const prev = i === 0 ? stage.count : funnel.stages[i - 1].count;
            const width = top > 0 ? Math.max(2, Math.round((stage.count / top) * 100)) : 0;
            return (
              <div key={stage.key}>
                <div className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="font-medium">{stage.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    <span className="font-medium text-foreground">{stage.count}</span>
                    {i > 0 ? ` · ${pct(stage.count, top)} of signups · ${pct(stage.count, prev)} of the step before` : ""}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{stage.hint}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-medium">Where people get stuck</h2>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="font-medium tabular-nums">{funnel.stuckUnconfirmed}</span> signed up and never confirmed their
            email.
          </p>
          <p>
            <span className="font-medium tabular-nums">{funnel.stuckUnpaid}</span> have an account but haven&apos;t paid.
          </p>
          <p className="pt-2 text-xs text-muted-foreground">
            Stages after payment aren&apos;t strictly in order: someone can add a competitor before connecting an assistant.
            Before signup, use Vercel Analytics for visitors and pageviews, and Google Analytics for the step events
            (visitors who accepted cookies only).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
