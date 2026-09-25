import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { answerQuestion, type AskContextSignal } from "@/lib/anthropic";
import { isOldSignal } from "@/lib/signal-freshness";

type Client = SupabaseClient<Database>;

const LOOKBACK_DAYS = 90;

// Builds the account context Ask reasons over (positioning, ICP, tracked
// competitors, the last 90 days of scored signals, pending competitor
// suggestions) and answers one question. Shared by the in-app Ask box (which
// passes its RLS-scoped client) and the MCP ask tool (service-role client):
// every query is filtered by accountId explicitly, so it's correct with
// either.
export async function askAccountQuestion(supabase: Client, accountId: string, question: string): Promise<string> {
  const { data: account } = await supabase
    .from("accounts")
    .select("name, positioning, icp")
    .eq("id", accountId)
    .single();

  const { data: competitors } = await supabase
    .from("competitors")
    .select("id, name, category")
    .eq("account_id", accountId);

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
    supabase.from("suggested_competitors").select("name, category, reasoning").eq("account_id", accountId).eq("status", "pending"),
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

  return answerQuestion(
    question,
    {
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
    },
    accountId
  );
}
