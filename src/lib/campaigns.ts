import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type CampaignSegment = "waitlist_not_signed_up";

export const SEGMENT_LABELS: Record<CampaignSegment, string> = {
  waitlist_not_signed_up: "Waitlist: not yet signed up",
};

type Lead = { email: string; companyName: string | null };

// The only segment today: everyone who joined the waitlist but whose email
// doesn't match an actual auth user yet. Recomputed fresh at both preview
// and send time rather than cached, since it's small and changes constantly
// pre-launch.
export async function getSegmentLeads(segment: CampaignSegment): Promise<Lead[]> {
  if (segment !== "waitlist_not_signed_up") return [];

  const admin = createAdminClient();

  const { data: signups } = await admin
    .from("waitlist_signups")
    .select("email, company_name")
    .order("created_at", { ascending: true });

  const existingEmails = new Set<string>();
  let page = 1;
  for (;;) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (!data || data.users.length === 0) break;
    for (const u of data.users) {
      if (u.email) existingEmails.add(u.email.toLowerCase());
    }
    if (data.users.length < 200) break;
    page += 1;
  }

  return (signups ?? [])
    .filter((s) => !existingEmails.has(s.email.toLowerCase()))
    .map((s) => ({ email: s.email, companyName: s.company_name }));
}

// {{company}} → the lead's company name, or a generic fallback if unset.
export function personalize(template: string, lead: Lead): string {
  return template.replaceAll("{{company}}", lead.companyName || "there");
}
