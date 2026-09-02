import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountContext } from "@/lib/impersonation";
import { competitorCap, competitorCapLabel } from "@/lib/tier-limits";
import { discoverCompetitorUrls } from "@/lib/scraping";
import { suggestCompetitorCategories } from "@/lib/anthropic";

// Scoped to the caller's own account via RLS, except during an admin "View
// as" session (resolveAccountContext swaps in the impersonated account and
// an RLS-bypassing client) — unlike /api/admin/competitors, this never
// touches an account the caller doesn't own or isn't impersonating even if
// account_id were spoofed.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { accountId, db } = await resolveAccountContext(supabase, user.id);
  if (!accountId) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 400 });
  }

  const { data: account } = await db
    .from("accounts")
    .select("tier, demo_mode")
    .eq("id", accountId)
    .single();

  const { count } = await db
    .from("competitors")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId);

  const tier = account?.tier ?? "starter";
  const limit = competitorCap(tier, account?.demo_mode ?? false);
  if ((count ?? 0) >= limit) {
    return NextResponse.json(
      { error: `Your plan tracks up to ${competitorCapLabel(limit)} competitors. Upgrade to add more.` },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const domain = typeof body?.domain === "string" ? body.domain.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const [urls, categories] = await Promise.all([
    domain ? discoverCompetitorUrls(domain) : Promise.resolve({ pricingUrl: null, careersUrl: null }),
    suggestCompetitorCategories([{ name, domain: domain || null }], accountId).catch(() => [""]),
  ]);

  const { data, error } = await db
    .from("competitors")
    .insert({
      account_id: accountId,
      name,
      domain: domain || null,
      category: categories[0] || null,
      pricing_url: urls.pricingUrl,
      careers_url: urls.careersUrl,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ competitor: data });
}
