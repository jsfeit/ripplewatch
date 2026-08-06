import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchClosedLostDealNotes } from "@/lib/hubspot";
import { extractWinLossEntries } from "@/lib/anthropic";

// HubSpot only tracks a "closed lost reason" property in practice (closed-
// won deals rarely have an equivalent field unless an account has
// customized their CRM), so this only ever produces "lost" entries — same
// honest limitation as the fact sheet's own "why we win is thinner without
// real evidence" framing.
export async function POST() {
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

  const { data: integration } = await supabase
    .from("integrations")
    .select("credentials")
    .eq("account_id", profile.account_id)
    .eq("provider", "hubspot")
    .eq("connected", true)
    .maybeSingle();

  const credentials = integration?.credentials as { access_token: string } | null;
  if (!credentials?.access_token) {
    return NextResponse.json({ error: "HubSpot isn't connected for this account." }, { status: 400 });
  }

  const { data: competitors } = await supabase
    .from("competitors")
    .select("id, name")
    .eq("account_id", profile.account_id);
  if (!competitors || competitors.length === 0) {
    return NextResponse.json({ error: "Add a competitor before syncing." }, { status: 400 });
  }

  const dealNotes = await fetchClosedLostDealNotes(credentials.access_token);
  if (dealNotes.length === 0) {
    return NextResponse.json({ imported: 0, skipped: 0 });
  }

  const extracted = await extractWinLossEntries(
    competitors.map((c) => c.name),
    dealNotes.join("\n"),
    profile.account_id
  );

  const competitorByName = new Map(competitors.map((c) => [c.name, c.id]));
  const matched = extracted
    .map((e) => ({ competitor_id: competitorByName.get(e.competitor), outcome: e.outcome, reason: e.reason }))
    .filter((e): e is { competitor_id: string; outcome: "won" | "lost"; reason: string } => Boolean(e.competitor_id));

  const { data: existing } = await supabase
    .from("competitor_win_loss")
    .select("competitor_id, reason")
    .in("competitor_id", [...new Set(matched.map((m) => m.competitor_id))]);
  const existingSet = new Set((existing ?? []).map((e) => `${e.competitor_id}::${e.reason}`));
  const toInsert = matched.filter((m) => !existingSet.has(`${m.competitor_id}::${m.reason}`));

  if (toInsert.length > 0) {
    const { error } = await supabase
      .from("competitor_win_loss")
      .insert(toInsert.map((m) => ({ ...m, created_by: user.id })));
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    imported: toInsert.length,
    skipped: extracted.length - toInsert.length,
  });
}
