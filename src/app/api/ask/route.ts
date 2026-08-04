import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { answerQuestion, type AskContextSignal } from "@/lib/anthropic";
import { isOldSignal } from "@/lib/signal-freshness";

const LOOKBACK_DAYS = 90;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ error: "Question is required." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();
  if (!profile?.account_id) {
    return NextResponse.json({ error: "No account found." }, { status: 400 });
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("name, positioning, icp")
    .eq("id", profile.account_id)
    .single();

  const { data: competitors } = await supabase
    .from("competitors")
    .select("id, name, category")
    .eq("account_id", profile.account_id);

  const competitorIds = (competitors ?? []).map((c) => c.id);
  const competitorNameById = new Map((competitors ?? []).map((c) => [c.id, c.name]));

  const sinceDate = new Date();
  sinceDate.setUTCDate(sinceDate.getUTCDate() - LOOKBACK_DAYS);

  const [{ data: signals }, { data: suggestedCompetitors }] = await Promise.all([
    competitorIds.length
      ? supabase
          .from("signals")
          .select("competitor_id, type, title, occurred_on, relevance_level, relevance_score, relevance_reasoning, summary")
          .in("competitor_id", competitorIds)
          .gte("occurred_on", sinceDate.toISOString().slice(0, 10))
          .order("occurred_on", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] }),
    // Dismissed suggestions are deliberately excluded — a closed decision,
    // not something Ask should relitigate if asked "did we consider X."
    supabase
      .from("suggested_competitors")
      .select("name, category, reasoning")
      .eq("account_id", profile.account_id)
      .eq("status", "pending"),
  ]);

  const contextSignals: AskContextSignal[] = (signals ?? []).map((s) => ({
    competitor: competitorNameById.get(s.competitor_id) ?? "Unknown",
    type: s.type,
    title: s.title,
    occurredOn: s.occurred_on,
    relevanceLevel: s.relevance_level,
    relevanceScore: s.relevance_score,
    relevanceReasoning: s.relevance_reasoning,
    summary: s.summary,
    isBackground: isOldSignal(s.occurred_on),
  }));

  try {
    const answer = await answerQuestion(question, {
      companyName: account?.name ?? "Your company",
      positioning: account?.positioning ?? null,
      icp: account?.icp ?? null,
      competitors: (competitors ?? []).map((c) => ({ name: c.name, category: c.category })),
      signals: contextSignals,
      suggestedCompetitors: (suggestedCompetitors ?? []).map((s) => ({
        name: s.name,
        category: s.category,
        reasoning: s.reasoning,
      })),
    }, profile.account_id);
    return NextResponse.json({ answer });
  } catch (err) {
    console.error("ask failed:", err);
    return NextResponse.json({ error: "Couldn't get an answer just now; try again in a moment." }, { status: 502 });
  }
}
