import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountContext } from "@/lib/impersonation";
import type { MarketGrowthDirection, MarketMaturity } from "@/lib/supabase/types";

const MATURITIES: MarketMaturity[] = ["emerging", "growing", "mature", "consolidating"];
const GROWTH_DIRECTIONS: MarketGrowthDirection[] = ["heating_up", "steady", "cooling"];

// A member correcting the researched market/product panel on their own
// dashboard (see MarketProfileCard) — not an admin-only route. RLS
// (migration 0072) is what actually scopes this to the caller's own
// account; `db` here is the impersonation-aware client from
// resolveAccountContext, same pattern as /api/competitors.
//
// Setting user_edited_at is the point of this route: the monthly cron
// checks it and skips re-generating this account until Regenerate clears
// it (see runMarketProfileForAccount), so a correction never gets
// silently overwritten by the next scheduled refresh.
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // Impersonation ("view as") is already blocked at the middleware level for
  // every mutating /api route outside /api/admin — see middleware.ts — so
  // no redundant check is needed here.
  const { accountId, db } = await resolveAccountContext(supabase, user.id);
  if (!accountId) return NextResponse.json({ error: "Finish onboarding first." }, { status: 400 });

  const body = await request.json().catch(() => null);
  const update: Record<string, string> = {};

  if (typeof body?.marketName === "string") {
    const v = body.marketName.trim();
    if (!v) return NextResponse.json({ error: "Market name can't be empty." }, { status: 400 });
    update.market_name = v.slice(0, 200);
  }
  if (typeof body?.marketDescription === "string") {
    const v = body.marketDescription.trim();
    if (!v) return NextResponse.json({ error: "Market description can't be empty." }, { status: 400 });
    update.market_description = v.slice(0, 1000);
  }
  if (typeof body?.productSummary === "string") {
    const v = body.productSummary.trim();
    if (!v) return NextResponse.json({ error: "Product summary can't be empty." }, { status: 400 });
    update.product_summary = v.slice(0, 1000);
  }
  if (typeof body?.growthReason === "string") {
    const v = body.growthReason.trim();
    if (!v) return NextResponse.json({ error: "Growth reason can't be empty." }, { status: 400 });
    update.growth_reason = v.slice(0, 500);
  }
  if (body?.maturity !== undefined) {
    if (!MATURITIES.includes(body.maturity)) return NextResponse.json({ error: "Invalid maturity." }, { status: 400 });
    update.maturity = body.maturity;
  }
  if (body?.growthDirection !== undefined) {
    if (!GROWTH_DIRECTIONS.includes(body.growthDirection)) {
      return NextResponse.json({ error: "Invalid growth direction." }, { status: 400 });
    }
    update.growth_direction = body.growthDirection;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await db
    .from("market_profile")
    .update({ ...update, user_edited_at: new Date().toISOString() })
    .eq("account_id", accountId)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "No market profile yet — it generates on your first crawl." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
