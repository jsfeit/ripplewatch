import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { loadCompetitorMomentum } from "@/lib/momentum-account";
import { computeNextBestActions } from "@/lib/next-best-action";
import type { ConnectMonthlyRecapEmail } from "@/lib/resend";

type Admin = SupabaseClient<Database>;

const WINDOW_DAYS = 30;
const TOP_SIGNALS = 3;

// The monthly recap for a Connect account, built entirely from the account's
// own data: no model call, so it costs nothing to produce and can't invent
// anything. Returns null when there's nothing worth a month's summary.
export async function buildMonthlyRecap(supabase: Admin, accountId: string, companyName: string): Promise<ConnectMonthlyRecapEmail | null> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();

  const momentum = await loadCompetitorMomentum(supabase, accountId);
  if (momentum.length === 0) return null;
  const nameById = new Map(momentum.map((m) => [m.competitor.id, m.competitor.name]));

  const { data: signals } = await supabase
    .from("signals")
    .select("competitor_id, title, relevance_level, relevance_score, relevance_reasoning")
    .in("competitor_id", [...nameById.keys()])
    .gte("created_at", since)
    .neq("source", "backfill");
  const recent = signals ?? [];
  const high = recent.filter((s) => s.relevance_level === "High");

  const { data: deals } = await supabase
    .from("competitor_win_loss")
    .select("outcome")
    .eq("account_id", accountId)
    .gte("created_at", since);
  const won = (deals ?? []).filter((d) => d.outcome === "won").length;
  const lost = (deals ?? []).filter((d) => d.outcome === "lost").length;
  const decided = won + lost;

  const next = (await computeNextBestActions(supabase, accountId)).next;

  const competitors = momentum.map((m) => ({
    name: m.competitor.name,
    label: m.momentum.label,
    highCount: high.filter((s) => s.competitor_id === m.competitor.id).length,
  }));
  const top = [...high]
    .sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0))
    .slice(0, TOP_SIGNALS)
    .map((s) => ({ competitor: nameById.get(s.competitor_id) ?? "", title: s.title, why: s.relevance_reasoning }));

  // A month where nothing changed at any competitor has no recap to give
  // (deals alone don't make one: the weekly briefing covers those).
  if (recent.length === 0) return null;

  const heating = competitors.filter((c) => c.label === "Heating up").map((c) => c.name);
  const summary: string[] = [
    `In the last 30 days Ripplewatch picked up ${recent.length} change${recent.length === 1 ? "" : "s"} across ${competitors.length} competitor${competitors.length === 1 ? "" : "s"}, ${high.length} of them High relevance to ${companyName}.`,
  ];
  if (heating.length > 0) summary.push(`Heating up: ${heating.join(", ")}.`);
  if (decided > 0) {
    summary.push(`You logged ${decided} decided deal${decided === 1 ? "" : "s"}: ${won} won, ${lost} lost (${Math.round((won / decided) * 100)}% win rate).`);
  } else {
    summary.push("No won or lost deals were logged this month, which is the biggest thing missing from these reads.");
  }

  return {
    subject: `${companyName}: your competitive month in review`,
    headline: "Your month in review",
    summary,
    competitors,
    topSignals: top,
    nextStep: next ? `${next.headline} ${next.why}`.trim() : null,
    tryAsking: [
      "What changed with my competitors this month, and what should I do about it?",
      decided > 0 ? "Which competitor is costing us the most deals?" : "Here's how a recent deal went: we lost to [competitor] because...",
    ],
  };
}
