import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountContext } from "@/lib/impersonation";
import { competitorCap, competitorCapLabel } from "@/lib/tier-limits";
import { discoverCompetitorUrls } from "@/lib/scraping";
import { createAdminClient } from "@/lib/supabase/admin";
import { reviewNewCompetitor } from "@/lib/competitor-intake";

export const maxDuration = 120;

// Promotes a discovered suggestion into a real tracked competitor. Scoped to
// the caller's own account via RLS on both tables, except during an admin
// "View as" session (resolveAccountContext swaps in the impersonated
// account and an RLS-bypassing client) — the suggestion lookup implicitly
// checks ownership, so a spoofed id from another account just 404s rather
// than leaking or acting on it.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const { data: suggestion } = await db
    .from("suggested_competitors")
    .select("status, domain, name, category")
    .eq("id", id)
    .eq("account_id", accountId)
    .maybeSingle();
  if (!suggestion) {
    return NextResponse.json({ error: "Suggestion not found." }, { status: 404 });
  }
  if (suggestion.status !== "pending") {
    return NextResponse.json({ error: "This suggestion has already been reviewed." }, { status: 400 });
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
      { error: `Your plan tracks up to ${competitorCapLabel(limit)} competitors. Upgrade to add more.`, upgradeRequired: true },
      { status: 403 }
    );
  }

  const urls = suggestion.domain
    ? await discoverCompetitorUrls(suggestion.domain)
    : { pricingUrl: null, careersUrl: null };

  const { data: competitor, error } = await db
    .from("competitors")
    .insert({
      account_id: accountId,
      name: suggestion.name,
      domain: suggestion.domain,
      category: suggestion.category,
      pricing_url: urls.pricingUrl,
      careers_url: urls.careersUrl,
    })
    .select("id, name, domain, account_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await db.from("suggested_competitors").update({ status: "added" }).eq("id", id);

  // Same background read as a hand-typed competitor: queue a manual follow-up
  // if we can't get a reliable read on it.
  after(() =>
    reviewNewCompetitor(createAdminClient(), competitor, process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin)
  );

  return NextResponse.json({ competitor });
}
