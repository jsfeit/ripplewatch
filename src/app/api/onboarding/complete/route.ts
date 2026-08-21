import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/resend";
import { discoverCompetitorUrls } from "@/lib/scraping";
import { suggestCompetitorCategories, researchCompanyContext } from "@/lib/anthropic";
import { COMPETITOR_LIMIT } from "@/lib/tier-limits";

type CompetitorInput = { name: string; domain: string };

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // Idempotency guard: a retried/double-clicked submission (the client has
  // its own guard against this too, but this is the real source of truth)
  // used to insert a second, orphaned accounts row and then fail linking
  // the profile to it — profiles.account_id can only ever point at one
  // account, so a second insert was always going to be wasted. Treat an
  // already-linked profile as success instead, returning the existing
  // account rather than erroring.
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();
  if (existingProfile?.account_id) {
    return NextResponse.json({ ok: true, accountId: existingProfile.account_id });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const {
    companyName,
    positioning,
    icp,
    competitors,
    hasSalesCrm,
    hasPlg,
    lostDealReasons,
    churnReasons,
    tier,
  }: {
    companyName: string;
    positioning: string;
    icp: string;
    competitors: CompetitorInput[];
    hasSalesCrm: boolean;
    hasPlg: boolean;
    lostDealReasons: string;
    churnReasons: string;
    tier?: string;
  } = body;

  const namedCompetitors = (competitors ?? []).filter((c) => c.name?.trim());
  if (!companyName?.trim() || namedCompetitors.length < 3) {
    return NextResponse.json({ error: "Missing required onboarding fields." }, { status: 400 });
  }

  // Backstop for the client-side cap on the competitors step — keeps the
  // funnel consistent with the pricing page's per-tier limits (3/7/20) even
  // if this endpoint is hit directly rather than through the UI.
  const tierLimit = tier && tier in COMPETITOR_LIMIT ? COMPETITOR_LIMIT[tier as keyof typeof COMPETITOR_LIMIT] : null;
  if (tierLimit !== null && namedCompetitors.length > tierLimit) {
    return NextResponse.json(
      { error: `The ${tier} plan tracks up to ${tierLimit} competitors; remove some to continue.` },
      { status: 400 }
    );
  }

  // Generated up front rather than read back via `.select()` after insert:
  // the accounts SELECT policy requires profiles.account_id to already
  // point at this row, which isn't true until the update just below, so
  // an insert().select() chain would fail RLS on the RETURNING read-back.
  const accountId = crypto.randomUUID();

  const { error: accountError } = await supabase.from("accounts").insert({
    id: accountId,
    name: companyName.trim(),
    positioning: positioning?.trim() || null,
    icp: icp?.trim() || null,
    has_sales_crm: Boolean(hasSalesCrm),
    has_plg: Boolean(hasPlg),
    lost_deal_notes: lostDealReasons?.trim() || null,
    churn_notes: churnReasons?.trim() || null,
    contact_email: user.email,
    created_by: user.id,
  });

  if (accountError) {
    console.error("account insert failed:", accountError);
    return NextResponse.json({ error: "Could not create account." }, { status: 500 });
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ account_id: accountId })
    .eq("id", user.id);

  if (profileError) {
    return NextResponse.json({ error: "Could not link account to your profile." }, { status: 500 });
  }

  // Discovery fetches each competitor's homepage once, in parallel — with
  // up to 20 competitors on the Advanced tier, doing this sequentially
  // could add tens of seconds to onboarding completion. Category is
  // resolved the same way (one batched call, not per-competitor) so the
  // news-relevance filter has real disambiguating context from day one.
  const [competitorUrls, categories] = await Promise.all([
    Promise.all(
      namedCompetitors.map((c) => {
        const domain = c.domain?.trim() || null;
        return domain ? discoverCompetitorUrls(domain) : Promise.resolve({ pricingUrl: null, careersUrl: null });
      })
    ),
    suggestCompetitorCategories(
      namedCompetitors.map((c) => ({ name: c.name.trim(), domain: c.domain?.trim() || null })),
      accountId
    ).catch(() => namedCompetitors.map(() => "")),
  ]);

  const { error: competitorsError } = await supabase.from("competitors").insert(
    namedCompetitors.map((c, i) => ({
      account_id: accountId,
      name: c.name.trim(),
      domain: c.domain?.trim() || null,
      category: categories[i] || null,
      pricing_url: competitorUrls[i].pricingUrl,
      careers_url: competitorUrls[i].careersUrl,
    }))
  );

  if (competitorsError) {
    return NextResponse.json({ error: "Could not save competitors." }, { status: 500 });
  }

  // Link any documents uploaded before the account existed (they were
  // stored with account_id null, scoped to this user only).
  await supabase
    .from("account_documents")
    .update({ account_id: accountId })
    .eq("uploaded_by", user.id)
    .is("account_id", null);

  // Best-effort — a welcome email failing shouldn't block onboarding.
  const appUrl = new URL(request.url).origin;
  sendWelcomeEmail(user.email!, companyName.trim(), appUrl).catch((err) =>
    console.error("welcome email failed:", err)
  );

  // Also best-effort and fire-and-forget: computed once here so the first
  // crawl's scoring calls already have it, instead of every account's first
  // crawl paying to self-heal it (see ensureCompanyResearch in crawl.ts,
  // which still covers accounts that predate this or where this call fails).
  researchCompanyContext(companyName.trim(), positioning?.trim() || null, accountId)
    .then((summary) =>
      supabase
        .from("accounts")
        .update({ company_research: summary, company_research_updated_at: new Date().toISOString() })
        .eq("id", accountId)
    )
    .catch((err) => console.error("company research failed:", err));

  return NextResponse.json({ ok: true, accountId });
}
