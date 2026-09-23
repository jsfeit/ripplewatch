import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runWinLossTrendsForAccount } from "@/lib/win-loss-trends";

// LLM-heavy but bounded (one call, capped entry/signal counts in
// anthropic.ts) — a generous ceiling in case an account has a lot of
// logged win/loss history, same reasoning as the fact-sheet route.
export const maxDuration = 60;

// The manual "Refresh" button in Trends — same generation
// runWinLossTrendsForAccount also runs automatically (once on an account's
// first crawl with enough data, then monthly via /api/cron/industry-trends;
// see win-loss-trends.ts), so a click here can't drift from what shows up
// on its own. Uses the caller's own RLS-scoped client, not the admin
// client the automatic paths use, since this is a user-initiated request.
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
  const accountId = profile.account_id;

  const { data: account } = await supabase.from("accounts").select("*").eq("id", accountId).single();
  if (!account) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const { data: competitors } = await supabase.from("competitors").select("id, name").eq("account_id", accountId);

  const result = await runWinLossTrendsForAccount(supabase, account, competitors ?? []);

  if (result.skipped === "too_few_entries") {
    return NextResponse.json({ trends: [], generatedAt: null, totalEntries: result.entries, insufficientData: true });
  }
  if (!result.generated) {
    return NextResponse.json({ error: "Could not generate trends. Try again shortly." }, { status: 500 });
  }

  const { data: trends } = await supabase
    .from("win_loss_trends")
    .select("theme, summary, won_count, lost_count, example_reasons, related_signals, generated_at")
    .eq("account_id", accountId)
    .order("won_count", { ascending: false });

  return NextResponse.json({
    trends: (trends ?? []).map((t) => ({
      theme: t.theme,
      summary: t.summary,
      wonCount: t.won_count,
      lostCount: t.lost_count,
      exampleReasons: t.example_reasons,
      relatedSignals: t.related_signals,
    })),
    generatedAt: trends?.[0]?.generated_at ?? new Date().toISOString(),
    totalEntries: result.entries,
    insufficientData: false,
  });
}
