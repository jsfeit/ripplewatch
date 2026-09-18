import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { SupabaseNotConfigured } from "@/components/admin/not-configured";
import { FollowupCard, type FollowupCardData } from "@/components/admin/followup-card";

export const metadata = { title: "Follow-ups | Admin" };
export const dynamic = "force-dynamic";

const REASON_LABELS: Record<string, string> = {
  blocked: "the site blocks automated requests",
  unreachable: "the site didn't load for us",
  ok: "the site loaded but we found no readable pricing page or job board",
  unread: "pricing and open roles couldn't be read directly",
};

// Pre-built searches so the person doing this doesn't have to type anything
// to start: the site itself, its likely pricing and careers pages, an archived
// copy, and the places that usually have the answer for a site that blocks us.
function linksFor(domain: string, name: string | null): { label: string; href: string }[] {
  const q = encodeURIComponent;
  const label = name ?? domain;
  return [
    { label: "Open the site", href: `https://${domain}` },
    { label: "Pricing page", href: `https://${domain}/pricing` },
    { label: "Careers page", href: `https://${domain}/careers` },
    { label: "Archived pricing page", href: `https://web.archive.org/web/2/https://${domain}/pricing` },
    { label: "Google: pricing", href: `https://www.google.com/search?q=${q(`${label} pricing`)}` },
    { label: "Google: jobs", href: `https://www.google.com/search?q=${q(`${label} careers open roles`)}` },
    { label: "LinkedIn jobs", href: `https://www.linkedin.com/jobs/search/?keywords=${q(label)}` },
    { label: "G2", href: `https://www.g2.com/search?query=${q(label)}` },
  ];
}

export default async function AdminFollowupsPage() {
  const configured = isSupabaseConfigured();
  const supabase = configured ? createAdminClient() : null;

  const pendingRes = supabase
    ? await supabase.from("manual_followups").select("*").eq("status", "pending").order("created_at", { ascending: true })
    : { data: null, error: null };
  const recentRes = supabase
    ? await supabase
        .from("manual_followups")
        .select("id, kind, domain, status, requester_email, competitor_name, resolved_at")
        .neq("status", "pending")
        .order("resolved_at", { ascending: false })
        .limit(15)
    : { data: null, error: null };

  const pending = pendingRes.data ?? [];
  const accountIds = Array.from(new Set(pending.map((f) => f.account_id).filter((id): id is string => Boolean(id))));
  const { data: accounts } =
    supabase && accountIds.length > 0
      ? await supabase.from("accounts").select("id, name").in("id", accountIds)
      : { data: [] as { id: string; name: string }[] };
  const accountName = new Map((accounts ?? []).map((a) => [a.id, a.name]));

  const cards: FollowupCardData[] = pending.map((f) => {
    const draft = f.draft as Record<string, unknown> | null;
    return {
      id: f.id,
      kind: f.kind,
      domain: f.domain,
      reasonLabel: REASON_LABELS[f.reason ?? "unread"] ?? REASON_LABELS.unread,
      createdLabel: new Date(f.created_at).toLocaleString(),
      requesterEmail: f.requester_email,
      accountId: f.account_id,
      accountName: f.account_id ? accountName.get(f.account_id) ?? null : null,
      competitorName: f.competitor_name,
      links: linksFor(f.domain, f.competitor_name),
      draft: draft
        ? {
            pricingSummary: String(draft.pricingSummary ?? ""),
            hiringSummary: String(draft.hiringSummary ?? ""),
            cheapestPrice: typeof draft.cheapestPrice === "number" ? draft.cheapestPrice : null,
            pricePeriod: typeof draft.pricePeriod === "string" ? draft.pricePeriod : null,
            openRoles: typeof draft.openRoles === "number" ? draft.openRoles : null,
            sources: Array.isArray(draft.sources) ? (draft.sources as { title: string; url: string }[]) : [],
          }
        : null,
    };
  });

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Follow-ups</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sites the automation couldn&apos;t get a reliable read on, from the public snapshot tool and from competitors
          customers added. Do the check by hand, record what you found, and it goes back to the visitor by email or
          into the customer&apos;s account. You get an email at the operator address for each new one.
        </p>
      </div>

      {!configured ? (
        <SupabaseNotConfigured />
      ) : pendingRes.error ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Couldn&apos;t load follow-ups: {pendingRes.error.message}. If this says the table doesn&apos;t exist, migration
          0070_manual_followups.sql hasn&apos;t been applied yet.
        </p>
      ) : cards.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Nothing waiting on you.
        </p>
      ) : (
        <div className="space-y-5">
          {cards.map((card) => (
            <FollowupCard key={card.id} data={card} />
          ))}
        </div>
      )}

      {(recentRes.data ?? []).length > 0 ? (
        <div className="mt-10">
          <h2 className="text-sm font-semibold">Recently handled</h2>
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border text-sm">
            {(recentRes.data ?? []).map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span>
                  {f.kind === "competitor" ? f.competitor_name ?? f.domain : f.domain}
                  <span className="text-muted-foreground">
                    {" "}
                    {f.kind === "snapshot" && f.requester_email ? `for ${f.requester_email}` : "(customer competitor)"}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {f.status} {f.resolved_at ? new Date(f.resolved_at).toLocaleDateString() : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
