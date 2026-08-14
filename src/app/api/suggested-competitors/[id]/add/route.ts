import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { COMPETITOR_LIMIT, competitorLimitLabel } from "@/lib/tier-limits";
import { discoverCompetitorUrls } from "@/lib/scraping";

// Promotes a discovered suggestion into a real tracked competitor. Scoped to
// the caller's own account via RLS on both tables — the suggestion lookup
// implicitly checks ownership, so a spoofed id from another account just
// 404s rather than leaking or acting on it.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();
  if (!profile?.account_id) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 400 });
  }

  const { data: suggestion } = await supabase
    .from("suggested_competitors")
    .select("*")
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .maybeSingle();
  if (!suggestion) {
    return NextResponse.json({ error: "Suggestion not found." }, { status: 404 });
  }
  if (suggestion.status !== "pending") {
    return NextResponse.json({ error: "This suggestion has already been reviewed." }, { status: 400 });
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("tier")
    .eq("id", profile.account_id)
    .single();

  const { count } = await supabase
    .from("competitors")
    .select("id", { count: "exact", head: true })
    .eq("account_id", profile.account_id);

  const tier = account?.tier ?? "starter";
  const limit = COMPETITOR_LIMIT[tier];
  if ((count ?? 0) >= limit) {
    return NextResponse.json(
      { error: `Your plan tracks up to ${competitorLimitLabel(tier)} competitors. Upgrade to add more.`, upgradeRequired: true },
      { status: 403 }
    );
  }

  const urls = suggestion.domain
    ? await discoverCompetitorUrls(suggestion.domain)
    : { pricingUrl: null, careersUrl: null };

  const { data: competitor, error } = await supabase
    .from("competitors")
    .insert({
      account_id: profile.account_id,
      name: suggestion.name,
      domain: suggestion.domain,
      category: suggestion.category,
      pricing_url: urls.pricingUrl,
      careers_url: urls.careersUrl,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("suggested_competitors").update({ status: "added" }).eq("id", id);

  return NextResponse.json({ competitor });
}
