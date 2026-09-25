import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizeDomain, DOMAIN_PATTERN, isBlockedHost } from "@/lib/domain";
import { buildSnapshot, recordSnapshotLead, toLookup } from "@/lib/snapshot";
import { createFollowup, announceFollowup } from "@/lib/followups";
import { countUnattributedLlmCalls } from "@/lib/usage";

// Homepage + pricing (live, then archived) + hiring board all run in
// parallel with their own time caps (see the snapshot fetchers in
// scraping.ts), plus one LLM extraction call. A recent-activity web search
// (capped at 25s) now runs alongside those for nearly every lookup, not just
// as a fallback. When a site can't be read at all, an additional web-search
// research step for pricing/hiring (capped at 40s) also overlaps with the
// rest, so the worst case is roughly 35s of fetching plus 40s of that
// fallback research, both already overlapping the 25s activity search.
// Explicit because a slow or uncooperative third-party site could otherwise
// eat into it.
export const maxDuration = 120;

// Global ceiling on how many anonymous snapshot lookups may call Claude per
// rolling 24 hours, across every visitor. The per-IP limit below is in-memory
// and per server instance, so on its own it doesn't stop a script that
// rotates IPs; this does. ~2 cents a lookup, so the cap bounds worst-case
// public spend at a few dollars a day. Past it the tool still fetches pages
// and reads hiring, and falls back to the manual follow-up path for pricing.
const SNAPSHOT_DAILY_LLM_CAP = 300;

// Web research (search fee plus tokens) costs more per call than the pricing
// extraction and only runs for sites we couldn't read, so it has its own,
// lower ceiling.
const SNAPSHOT_DAILY_RESEARCH_CAP = 100;

// The recent-activity search runs on nearly every lookup (it's the tool's
// headline finding now, not a fallback), so its cap sits closer to the main
// LLM cap than to the blocked-site research cap above. Past it, the snapshot
// still shows pricing/hiring as usual, just without the activity signals.
const SNAPSHOT_DAILY_ACTIVITY_CAP = 250;

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!checkRateLimit(`snapshot:${getClientIp(request)}`, 5, 60 * 60_000)) {
    return NextResponse.json({ error: "Too many requests. Try again in a bit." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const rawDomain = typeof body?.domain === "string" ? body.domain.trim() : "";
  const utmSource = typeof body?.utm_source === "string" ? body.utm_source.trim().slice(0, 100) : "";
  const utmMedium = typeof body?.utm_medium === "string" ? body.utm_medium.trim().slice(0, 100) : "";
  const utmCampaign = typeof body?.utm_campaign === "string" ? body.utm_campaign.trim().slice(0, 100) : "";

  if (!VALID_EMAIL.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const domain = normalizeDomain(rawDomain).toLowerCase();
  if (!DOMAIN_PATTERN.test(domain) || isBlockedHost(domain)) {
    return NextResponse.json({ error: "Enter a real competitor domain, e.g. acme.com." }, { status: 400 });
  }

  const usedToday = await countUnattributedLlmCalls("extractPricingStructure", 24);
  const llmAllowed = usedToday === null || usedToday < SNAPSHOT_DAILY_LLM_CAP;
  if (!llmAllowed) console.warn(`snapshot LLM cap (${SNAPSHOT_DAILY_LLM_CAP}/24h) reached, skipping pricing extraction`);

  const researchUsed = await countUnattributedLlmCalls("researchDomainPublicly", 24);
  const researchAllowed = researchUsed === null || researchUsed < SNAPSHOT_DAILY_RESEARCH_CAP;
  if (!researchAllowed) console.warn(`snapshot research cap (${SNAPSHOT_DAILY_RESEARCH_CAP}/24h) reached, skipping web research`);

  const activityUsed = await countUnattributedLlmCalls("researchRecentActivity", 24);
  const activityAllowed = activityUsed === null || activityUsed < SNAPSHOT_DAILY_ACTIVITY_CAP;
  if (!activityAllowed) console.warn(`snapshot activity cap (${SNAPSHOT_DAILY_ACTIVITY_CAP}/24h) reached, skipping activity research`);

  const result = await buildSnapshot(domain, { llmAllowed, researchAllowed, activityAllowed });

  // Recorded whether or not we found anything (see recordSnapshotLead).
  // Awaited, not fire-and-forget: on a serverless function the work can be
  // cut off once the response is sent.
  const supabase = createAdminClient();
  const leadId = await recordSnapshotLead(supabase, {
    email,
    utmSource,
    utmMedium,
    utmCampaign,
    lookup: toLookup(result),
  });

  // Nothing reliable, even after searching public sources: queue it for a
  // person (Admin -> Follow-ups) and alert the operator. Also awaited, for the
  // same reason as above.
  if (result.needsManualCheck) {
    const followup = await createFollowup(supabase, {
      kind: "snapshot",
      domain,
      reason: result.reachability,
      requester_email: email,
      lead_id: leadId,
    });
    if (followup.status !== "duplicate") {
      await announceFollowup(followup.followup, {
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin,
      });
    }
  }

  return NextResponse.json(result);
}
