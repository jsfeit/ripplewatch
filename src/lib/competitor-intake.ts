import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { normalizeDomain } from "@/lib/domain";
import { buildSnapshot } from "@/lib/snapshot";
import { createFollowup, announceFollowup } from "@/lib/followups";

type AdminClient = SupabaseClient<Database>;
type Competitor = Pick<Database["public"]["Tables"]["competitors"]["Row"], "id" | "name" | "domain" | "account_id">;

// Runs after a signed-in customer adds (or re-points) a competitor, off the
// request path. It applies the same machinery the public snapshot uses (direct
// read, archived copies, public-sources research) once, up front, so a
// competitor we can't read doesn't silently sit empty in their dashboard until
// someone notices. If the site itself can be read, the normal daily crawl will
// fill everything in and there's nothing to do. If it can't, a follow-up is
// queued for a person, with any research attached as a draft to verify (not
// published to a paying customer's dashboard unreviewed), and the operator is
// emailed.
//
// A domain that doesn't exist or is just a placeholder is not queued: the add
// flow already told the customer, and there's nothing to look up.
export async function reviewNewCompetitor(supabase: AdminClient, competitor: Competitor, appUrl: string): Promise<void> {
  try {
    if (!competitor.domain) return;
    const domain = normalizeDomain(competitor.domain).toLowerCase();
    if (!domain) return;

    const result = await buildSnapshot(domain, { accountId: competitor.account_id });
    if (result.reachability === "no_such_site" || result.reachability === "placeholder") return;
    if (result.readDirectly) return;

    const { data: account } = await supabase.from("accounts").select("name").eq("id", competitor.account_id).maybeSingle();

    const followup = await createFollowup(supabase, {
      kind: "competitor",
      domain,
      reason: result.reachability === "ok" ? "unread" : result.reachability,
      account_id: competitor.account_id,
      competitor_id: competitor.id,
      competitor_name: competitor.name,
      draft: result.research ? { ...result.research } : null,
    });
    if (followup.status !== "duplicate") {
      await announceFollowup(followup.followup, { appUrl, accountName: account?.name ?? null });
    }
  } catch (err) {
    console.error(`competitor review failed for ${competitor.name}:`, err);
  }
}
