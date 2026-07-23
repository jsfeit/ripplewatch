import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CompetitorInput = { name: string; domain: string };

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
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
  }: {
    companyName: string;
    positioning: string;
    icp: string;
    competitors: CompetitorInput[];
    hasSalesCrm: boolean;
    hasPlg: boolean;
    lostDealReasons: string;
    churnReasons: string;
  } = body;

  const namedCompetitors = (competitors ?? []).filter((c) => c.name?.trim());
  if (!companyName?.trim() || namedCompetitors.length < 3) {
    return NextResponse.json({ error: "Missing required onboarding fields." }, { status: 400 });
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

  const { error: competitorsError } = await supabase.from("competitors").insert(
    namedCompetitors.map((c) => ({
      account_id: accountId,
      name: c.name.trim(),
      domain: c.domain?.trim() || null,
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

  return NextResponse.json({ ok: true, accountId });
}
