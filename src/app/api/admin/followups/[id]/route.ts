import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyCompetitorResolution, OPERATOR_EMAIL, type ManualResolution } from "@/lib/followups";
import { sendSnapshotManualResultEmail } from "@/lib/resend";
import { DEMO_URL } from "@/lib/demo";
import type { BillingModel } from "@/lib/supabase/types";

// Gated by middleware (/api/admin/:path* requires an admin session).
const BILLING_MODELS: BillingModel[] = ["subscription", "per_seat", "usage_based", "custom", "unknown"];

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== "resolve" && action !== "dismiss") {
    return NextResponse.json({ error: "action must be resolve or dismiss." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: followup } = await supabase.from("manual_followups").select("*").eq("id", id).maybeSingle();
  if (!followup) return NextResponse.json({ error: "Follow-up not found." }, { status: 404 });
  if (followup.status !== "pending") {
    return NextResponse.json({ error: "This follow-up was already handled." }, { status: 409 });
  }

  if (action === "dismiss") {
    await supabase.from("manual_followups").update({ status: "dismissed", resolved_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  const cheapestPrice = optionalNumber(body?.cheapestPrice);
  const openRoles = optionalNumber(body?.openRoles);
  if (Number.isNaN(cheapestPrice) || Number.isNaN(openRoles)) {
    return NextResponse.json({ error: "Price and open roles must be non-negative numbers." }, { status: 400 });
  }
  const billingModel: BillingModel = BILLING_MODELS.includes(body?.billingModel) ? body.billingModel : "unknown";
  const text = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 2000) : "");

  const resolution: ManualResolution = {
    billingModel,
    publiclyPriced: cheapestPrice !== null || (billingModel !== "custom" && billingModel !== "unknown"),
    cheapestPrice,
    pricePeriod: text(body?.pricePeriod) || null,
    pricingSummary: text(body?.pricingSummary),
    openRoles,
    hiringSummary: text(body?.hiringSummary),
    notes: text(body?.notes),
  };

  const hasAnything = resolution.pricingSummary || resolution.cheapestPrice !== null || resolution.openRoles !== null || resolution.hiringSummary;
  if (!hasAnything) {
    return NextResponse.json({ error: "Enter at least a pricing or hiring finding, or dismiss it instead." }, { status: 400 });
  }

  try {
    if (followup.kind === "competitor") {
      if (!followup.competitor_id) {
        return NextResponse.json({ error: "That competitor no longer exists." }, { status: 410 });
      }
      await applyCompetitorResolution(supabase, followup.competitor_id, resolution);
    } else if (followup.requester_email) {
      // Emailed before the item is marked resolved, so a send failure leaves
      // it pending to retry instead of losing it.
      await sendSnapshotManualResultEmail(followup.requester_email, {
        domain: followup.domain,
        pricingSummary: resolution.pricingSummary,
        hiringSummary: resolution.hiringSummary,
        notes: resolution.notes,
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin,
        demoUrl: DEMO_URL,
        replyTo: OPERATOR_EMAIL,
      });
    }
  } catch (err) {
    console.error("resolving follow-up failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't save." }, { status: 502 });
  }

  await supabase
    .from("manual_followups")
    .update({ status: "resolved", resolution, resolved_at: new Date().toISOString() })
    .eq("id", id);
  return NextResponse.json({ ok: true });
}
