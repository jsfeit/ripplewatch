import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingModel, Database, PricingTier } from "@/lib/supabase/types";
import { recordStateHistory } from "@/lib/scraping";
import { MANUAL_NOTE_PREFIX } from "@/lib/manual-data";
import { sendFollowupAlertEmail } from "@/lib/resend";

type AdminClient = SupabaseClient<Database>;
export type Followup = Database["public"]["Tables"]["manual_followups"]["Row"];
type FollowupInsert = Database["public"]["Tables"]["manual_followups"]["Insert"];

// Always alerted, in addition to anyone in ADMIN_EMAILS: this is the inbox
// that should hear about anything needing a person. Kept in code rather than
// only in an env var so the alert can't silently go nowhere if ADMIN_EMAILS
// is unset or points somewhere else.
export const OPERATOR_EMAIL = "jeremyripplewatch@gmail.com";

export function alertRecipients(): string[] {
  const fromEnv = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  return Array.from(new Set([OPERATOR_EMAIL, ...fromEnv]));
}

export type CreateFollowupResult =
  | { status: "created"; followup: Followup }
  // An open item for this competitor / lead+domain already exists, and the
  // operator was already alerted about it.
  | { status: "duplicate" }
  // Couldn't be saved (e.g. the table doesn't exist yet). Callers should still
  // alert with the details, so nothing is silently lost.
  | { status: "failed"; followup: Followup };

// Best-effort by design: a failure to record or announce a follow-up must
// never break the visitor's snapshot or a customer adding a competitor. On a
// save failure it hands back an unsaved copy so the caller can still send the
// alert email (with the details in it) instead of dropping the follow-up.
export async function createFollowup(supabase: AdminClient, input: FollowupInsert): Promise<CreateFollowupResult> {
  const { data, error } = await supabase.from("manual_followups").insert(input).select("*").single();
  if (!error) return { status: "created", followup: data };
  // 23505: an open item for this competitor / lead+domain already exists.
  if (error.code === "23505") return { status: "duplicate" };
  console.error("manual follow-up insert failed:", error.message);
  return {
    status: "failed",
    followup: {
      id: "unsaved",
      kind: input.kind,
      status: "pending",
      domain: input.domain,
      reason: input.reason ?? null,
      requester_email: input.requester_email ?? null,
      lead_id: input.lead_id ?? null,
      account_id: input.account_id ?? null,
      competitor_id: input.competitor_id ?? null,
      competitor_name: input.competitor_name ?? null,
      draft: input.draft ?? null,
      resolution: null,
      created_at: new Date().toISOString(),
      resolved_at: null,
    },
  };
}

export async function announceFollowup(followup: Followup, opts: { appUrl: string; accountName?: string | null }) {
  try {
    await sendFollowupAlertEmail(alertRecipients(), {
      kind: followup.kind,
      domain: followup.domain,
      reason: followup.reason ?? "unknown",
      requesterEmail: followup.requester_email,
      accountName: opts.accountName ?? null,
      competitorName: followup.competitor_name,
      hasDraft: followup.draft !== null,
      followupUrl:
        followup.id === "unsaved" ? `${opts.appUrl}/admin/followups` : `${opts.appUrl}/admin/followups#${followup.id}`,
    });
  } catch (err) {
    console.error("manual follow-up alert failed:", err);
  }
}

export type ManualResolution = {
  billingModel: BillingModel;
  publiclyPriced: boolean;
  cheapestPrice: number | null;
  pricePeriod: string | null;
  pricingSummary: string;
  openRoles: number | null;
  hiringSummary: string;
  notes: string;
};

// Writes a person's findings into the competitor's real records so the
// customer sees them in their dashboard exactly like an automatic read (plus
// a note saying it was checked by hand). Pricing and hiring are independent:
// whichever the operator left blank is left alone.
export async function applyCompetitorResolution(
  supabase: AdminClient,
  competitorId: string,
  r: ManualResolution
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const hasPricing = r.pricingSummary.trim() !== "" || r.cheapestPrice !== null;
  if (hasPricing) {
    const tiers: PricingTier[] =
      r.cheapestPrice !== null
        ? [{ name: "Entry plan (as listed)", price: r.cheapestPrice, price_period: r.pricePeriod, features: [] }]
        : [];
    const { error } = await supabase.from("competitor_pricing").upsert(
      {
        competitor_id: competitorId,
        billing_model: r.billingModel,
        publicly_priced: r.publiclyPriced,
        note: `${MANUAL_NOTE_PREFIX} on ${today}${r.pricingSummary.trim() ? `: ${r.pricingSummary.trim()}` : "."}`,
        tiers,
        last_checked_at: now,
      },
      { onConflict: "competitor_id" }
    );
    if (error) throw new Error(`Could not save pricing: ${error.message}`);
    if (r.cheapestPrice !== null) await recordStateHistory(supabase, competitorId, "lowest_price", r.cheapestPrice);
  }

  if (r.openRoles !== null) {
    const { error } = await supabase.from("competitor_hiring").upsert(
      {
        competitor_id: competitorId,
        open_role_count: r.openRoles,
        department_breakdown: {},
        source: "manual",
        last_checked_at: now,
      },
      { onConflict: "competitor_id" }
    );
    if (error) throw new Error(`Could not save hiring: ${error.message}`);
    await recordStateHistory(supabase, competitorId, "open_role_count", r.openRoles);
  }
}
