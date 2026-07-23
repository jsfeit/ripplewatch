import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { COMPETITOR_LIMIT, competitorLimitLabel } from "@/lib/tier-limits";

// Scoped to the caller's own account via RLS — unlike /api/admin/competitors,
// this never touches other accounts' data even if account_id were spoofed.
export async function POST(request: Request) {
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
      { error: `Your plan tracks up to ${competitorLimitLabel(tier)} competitors. Upgrade to add more.` },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const domain = typeof body?.domain === "string" ? body.domain.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("competitors")
    .insert({ account_id: profile.account_id, name, domain: domain || null })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ competitor: data });
}
