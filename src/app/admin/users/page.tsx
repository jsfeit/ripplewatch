import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { SupabaseNotConfigured } from "@/components/admin/not-configured";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { daysAgoIso, summarizeActivity, topFeatures, relativeTime, type ActivityRow } from "@/lib/activity";
import { LeadDripToggle } from "@/components/admin/lead-drip-toggle";
import { existingLookups, type SnapshotLookup } from "@/lib/snapshot";

export const metadata = { title: "Users & leads | Admin" };
export const dynamic = "force-dynamic";

const CAPTURE_POINT_LABELS: Record<string, string> = {
  onboarding: "Onboarding",
  quiz: "Quiz",
  blog: "Blog",
  snapshot: "Competitor snapshot",
};

// Same context each capture point already sends via metadata (see
// /api/leads and /api/snapshot) — rendered here so a lead is more than a
// bare email to whoever's triaging this list. Anything not covered by these
// two shapes (a future capture point, or metadata missing entirely) just
// shows "–" rather than a raw JSON dump.
const PRICING_STATE_LABELS: Record<SnapshotLookup["pricingState"], string> = {
  public: "public pricing",
  public_no_numbers: "public page, no numbers",
  sales_led: "sales-led",
  unreadable: "pricing page unreadable",
  no_page: "no pricing page found",
  unreachable: "blocked/unreachable",
};

function describeLookup(l: SnapshotLookup): string {
  const price = l.cheapestPrice != null ? `from $${l.cheapestPrice}${l.cheapestPeriod ? `/${l.cheapestPeriod}` : ""}` : null;
  const roles = l.openRoles != null ? `${l.openRoles} roles` : null;
  const flag = l.needsManualCheck ? "needs manual follow-up" : null;
  const detail = [PRICING_STATE_LABELS[l.pricingState], price, roles, flag].filter(Boolean).join(", ");
  return `${l.domain} (${detail})`;
}

// Rendered from the lead's metadata (see /api/leads, /api/snapshot) so a lead
// is more than a bare email to whoever's triaging this list. A snapshot lead
// can carry several lookups (one per competitor they tried); any lead, not
// just ones captured via the snapshot, can also carry lookups if they used
// the tool later, so those are shown alongside the original capture context.
function leadDetails(capturePoint: string | null, metadata: Record<string, unknown> | null): string {
  if (!metadata) return "–";
  const parts: string[] = [];
  if (capturePoint === "quiz" && typeof metadata.tier === "string") {
    const score = typeof metadata.score === "number" ? `${metadata.score}/15` : null;
    const weakest = typeof metadata.weakestTopic === "string" ? metadata.weakestTopic : null;
    parts.push([metadata.tier, score, weakest ? `weak: ${weakest}` : null].filter(Boolean).join(" · "));
  }
  const lookups = existingLookups(capturePoint, metadata);
  if (lookups.length > 0) {
    parts.push(lookups.map(describeLookup).join(" · "));
  }
  return parts.length > 0 ? parts.join(" | ") : "–";
}

type Person = {
  key: string;
  email: string;
  isUser: boolean;
  // Sign-up only exists for people with an account; a lead has just a
  // capture date.
  signedUpAt: string | null;
  capturedAt: string | null;
  lastSignInAt: string | null;
  loginCount: number;
  lastActiveAt: string | null;
  topUsed: [string, number][];
  role: string | null;
  accountId: string | null;
  accountName: string | null;
  company: string | null;
  leadId: string | null;
  capturePoint: string | null;
  details: string;
  utm: string | null;
  dripPaused: boolean;
  sortAt: number;
};

type Filter = "all" | "users" | "leads";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const filter: Filter = show === "users" || show === "leads" ? show : "all";

  const configured = isSupabaseConfigured();
  const people: Person[] = [];
  let error: string | null = null;

  if (configured) {
    const supabase = createAdminClient();

    const { data: userList, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (listError) {
      error = listError.message;
    } else {
      const [{ data: profiles }, { data: accounts }, { data: leads }, { data: activityRows }, { data: loginRows }] =
        await Promise.all([
          supabase.from("profiles").select("id, account_id, role"),
          supabase.from("accounts").select("id, name"),
          supabase.from("leads").select("*"),
          supabase
            .from("user_activity")
            .select("user_id, kind, path, created_at")
            .gte("created_at", daysAgoIso(30))
            .limit(50_000),
          supabase.from("user_activity").select("user_id").eq("kind", "login").limit(50_000),
        ]);

      const activity = summarizeActivity((activityRows ?? []) as ActivityRow[]);
      // Login counts aren't windowed: "logins" is all-time, feature usage is 30 days.
      const loginCounts = new Map<string, number>();
      for (const r of loginRows ?? []) loginCounts.set(r.user_id, (loginCounts.get(r.user_id) ?? 0) + 1);

      const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
      const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));
      const leadByEmail = new Map((leads ?? []).map((l) => [l.email.toLowerCase(), l]));
      const seenLeadEmails = new Set<string>();

      const leadFields = (l: (typeof leads extends (infer T)[] | null ? T : never) | undefined) => ({
        company: l?.company_name ?? null,
        leadId: l?.id ?? null,
        capturePoint: l?.capture_point ?? null,
        capturedAt: l?.created_at ?? null,
        details: l ? leadDetails(l.capture_point, l.metadata) : "–",
        utm: l?.utm_source ? [l.utm_source, l.utm_medium, l.utm_campaign].filter(Boolean).join(" / ") : null,
        dripPaused: Boolean(l?.drip_paused_at),
      });

      for (const u of userList.users) {
        const email = u.email ?? "–";
        const lead = leadByEmail.get(email.toLowerCase());
        if (lead) seenLeadEmails.add(email.toLowerCase());
        const profile = profileById.get(u.id);
        const account = profile?.account_id ? accountById.get(profile.account_id) : undefined;
        const a = activity.get(u.id);
        const times = [u.last_sign_in_at, a?.lastActiveAt, u.created_at].filter(Boolean) as string[];
        people.push({
          key: u.id,
          email,
          isUser: true,
          signedUpAt: u.created_at ?? null,
          lastSignInAt: u.last_sign_in_at ?? null,
          loginCount: loginCounts.get(u.id) ?? 0,
          lastActiveAt: a?.lastActiveAt ?? null,
          topUsed: topFeatures(a?.features ?? {}),
          role: profile?.role ?? null,
          accountId: account?.id ?? null,
          accountName: account?.name ?? null,
          sortAt: Math.max(...times.map((t) => new Date(t).getTime())),
          ...leadFields(lead),
        });
      }

      for (const l of leads ?? []) {
        if (seenLeadEmails.has(l.email.toLowerCase())) continue;
        people.push({
          key: l.id,
          email: l.email,
          isUser: false,
          signedUpAt: null,
          lastSignInAt: null,
          loginCount: 0,
          lastActiveAt: null,
          topUsed: [],
          role: null,
          accountId: null,
          accountName: null,
          sortAt: new Date(l.created_at).getTime(),
          ...leadFields(l),
        });
      }
      people.sort((a, b) => b.sortAt - a.sortAt);
    }
  }

  const userCount = people.filter((p) => p.isUser).length;
  const leadCount = people.length - userCount;
  const rows = people.filter((p) => filter === "all" || (filter === "users" ? p.isUser : !p.isUser));

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "Everyone", count: people.length },
    { id: "users", label: "Users", count: userCount },
    { id: "leads", label: "Leads only", count: leadCount },
  ];

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Users &amp; leads</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">Users</strong> have an account, so they have a sign-up date
          and login activity. <strong className="font-medium text-foreground">Leads</strong> only gave us an email
          (onboarding&apos;s first step, the quiz, the blog, or the competitor snapshot) and have not signed up, so
          there is no sign-up date, just when they were captured. A lead who later signs up becomes one row, marked
          as a user. Login counts and usage start from when tracking went live.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={t.id === "all" ? "/admin/users" : `/admin/users?show=${t.id}`}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === t.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.label} <span className="tabular-nums">{t.count}</span>
          </Link>
        ))}
      </div>

      {!configured ? (
        <SupabaseNotConfigured />
      ) : error ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Couldn&apos;t load users: {error}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Signed up</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead>Logins</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead>Uses most (30d)</TableHead>
                <TableHead>How they arrived</TableHead>
                <TableHead>Drip</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="font-medium">
                    {row.email}
                    {row.company ? <div className="text-xs font-normal text-muted-foreground">{row.company}</div> : null}
                  </TableCell>
                  <TableCell>
                    {row.isUser ? (
                      <Badge variant="secondary">User{row.role === "admin" ? " · admin" : ""}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Lead
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.accountId ? (
                      <Link href={`/admin/accounts/${row.accountId}`} className="text-primary hover:underline">
                        {row.accountName ?? "Unnamed account"}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">{row.isUser ? "No account" : "–"}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.isUser ? (
                      row.signedUpAt ? new Date(row.signedUpAt).toLocaleDateString() : "–"
                    ) : (
                      <div>
                        <span className="text-xs">Not signed up</span>
                        {row.capturedAt ? (
                          <div className="text-xs">captured {new Date(row.capturedAt).toLocaleDateString()}</div>
                        ) : null}
                      </div>
                    )}
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground"
                    title={row.lastSignInAt ? new Date(row.lastSignInAt).toLocaleString() : undefined}
                  >
                    {row.isUser ? relativeTime(row.lastSignInAt) : "–"}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{row.loginCount || "–"}</TableCell>
                  <TableCell
                    className="text-muted-foreground"
                    title={row.lastActiveAt ? new Date(row.lastActiveAt).toLocaleString() : undefined}
                  >
                    {row.lastActiveAt ? relativeTime(row.lastActiveAt) : "–"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.topUsed.length > 0 ? row.topUsed.map(([f, n]) => `${f} (${n})`).join(", ") : "–"}
                  </TableCell>
                  <TableCell className="max-w-xs text-xs text-muted-foreground">
                    {row.capturePoint ? (
                      <>
                        <span className="text-foreground">
                          {CAPTURE_POINT_LABELS[row.capturePoint] ?? row.capturePoint}
                        </span>
                        {row.details !== "–" ? <div>{row.details}</div> : null}
                        {row.utm ? <div>{row.utm}</div> : null}
                      </>
                    ) : (
                      "–"
                    )}
                  </TableCell>
                  <TableCell>
                    {row.leadId && row.capturePoint ? (
                      <LeadDripToggle id={row.leadId} initialPaused={row.dripPaused} />
                    ) : (
                      "–"
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    Nobody here yet.
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
