import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { SupabaseNotConfigured } from "@/components/admin/not-configured";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildOrdinalMap } from "@/lib/admin-numbering";
import { LeadDripToggle } from "@/components/admin/lead-drip-toggle";
import { existingLookups, type SnapshotLookup } from "@/lib/snapshot";

export const metadata = { title: "Leads | Admin" };
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

export default async function AdminLeadsPage() {
  const configured = isSupabaseConfigured();
  const { data: leads, error } = configured
    ? await createAdminClient()
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
    : { data: null, error: null };

  const leadNumbers = buildOrdinalMap(leads ?? [], (l) => l.id, (l) => l.created_at);

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {leads?.length ?? 0} email{leads?.length === 1 ? "" : "s"} captured across onboarding&apos;s first step,
          the competitive-intel quiz, the blog, and the competitor snapshot tool, before payment or account
          creation. Use this list to retarget anyone who didn&apos;t finish signing up.
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
                <TableHead>#</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Captured via</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>UTM source</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Drip</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads?.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-muted-foreground tabular-nums">#{leadNumbers.get(l.id)}</TableCell>
                  <TableCell className="font-medium">{l.email}</TableCell>
                  <TableCell className="text-muted-foreground">{l.company_name ?? "–"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.capture_point ? (CAPTURE_POINT_LABELS[l.capture_point] ?? l.capture_point) : "–"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{leadDetails(l.capture_point, l.metadata)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.utm_source
                      ? [l.utm_source, l.utm_medium, l.utm_campaign].filter(Boolean).join(" / ")
                      : "–"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(l.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {l.capture_point ? <LeadDripToggle id={l.id} initialPaused={Boolean(l.drip_paused_at)} /> : "–"}
                  </TableCell>
                </TableRow>
              ))}
              {leads?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
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
