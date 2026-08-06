import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFactSheet, type FactSheetSignal, type FactSheetWinLossEntry } from "@/lib/anthropic";
import { BILLING_MODEL_LABELS } from "@/lib/billing-model";

// How many of the most relevant recent signals to ground the fact sheet in
// — enough to reflect a real pattern, not so many that older, less
// relevant context dilutes what the model leads with.
const SIGNAL_CONTEXT_LIMIT = 8;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("account_id").eq("id", user.id).single();
  if (!profile?.account_id) {
    return NextResponse.json({ error: "No account." }, { status: 400 });
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("name, positioning, company_research")
    .eq("id", profile.account_id)
    .single();
  if (!account) {
    return NextResponse.json({ error: "No account." }, { status: 400 });
  }

  // RLS scopes this read to the caller's own account, so a competitor from
  // another account simply won't be found here.
  const { data: competitor } = await supabase.from("competitors").select("*").eq("id", id).single();
  if (!competitor) {
    return NextResponse.json({ error: "Competitor not found." }, { status: 404 });
  }

  const [{ data: pricing }, { data: winLoss }, { data: signals }] = await Promise.all([
    supabase
      .from("competitor_pricing")
      .select("billing_model, publicly_priced")
      .eq("competitor_id", id)
      .maybeSingle(),
    supabase
      .from("competitor_win_loss")
      .select("outcome, reason")
      .eq("competitor_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("signals")
      .select("title, relevance_reasoning, relevance_score, occurred_on")
      .eq("competitor_id", id)
      .eq("scored", true)
      .order("relevance_score", { ascending: false })
      .limit(SIGNAL_CONTEXT_LIMIT),
  ]);

  const pricingSummary = pricing
    ? `${BILLING_MODEL_LABELS[pricing.billing_model]}${pricing.publicly_priced ? ", publicly priced" : ", not publicly priced (custom/sales-led)"}`
    : null;

  const winLossEntries: FactSheetWinLossEntry[] = (winLoss ?? []).map((w) => ({
    outcome: w.outcome,
    reason: w.reason,
  }));

  const recentSignals: FactSheetSignal[] = (signals ?? []).map((s) => ({
    title: s.title,
    reasoning: s.relevance_reasoning,
    score: s.relevance_score,
    occurredOn: s.occurred_on,
  }));

  const result = await generateFactSheet(
    account.name,
    account.positioning,
    account.company_research,
    competitor.name,
    competitor.category,
    pricingSummary,
    winLossEntries,
    recentSignals,
    profile.account_id
  );

  const generatedAt = new Date().toISOString();
  const { error } = await supabase
    .from("competitors")
    .update({
      fact_sheet_why_we_win: result.whyWeWin.join("\n"),
      fact_sheet_why_we_lose: result.whyWeLose.join("\n"),
      fact_sheet_generated_at: generatedAt,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    whyWeWin: result.whyWeWin,
    whyWeLose: result.whyWeLose,
    generatedAt,
  });
}
