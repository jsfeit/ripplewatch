import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { loadCompetitorMomentum } from "@/lib/momentum-account";

type Client = SupabaseClient<Database>;

// Below this many total win/loss + scored-feedback reasons, theme detection is
// mostly noise — same threshold the trends engine itself uses.
const MIN_REASONS_FOR_TRENDS = 5;
const HOT_SIGNAL_WINDOW_DAYS = 21;

export type NextActionTool =
  | "add_competitor"
  | "set_context"
  | "log_win_loss"
  | "log_customer_feedback"
  | "ask";

export type NextAction = {
  id: string;
  tool: NextActionTool;
  // One imperative line the agent can say as-is.
  headline: string;
  // Grounded in this account's real data, so the ask reads as "here's why
  // this matters to you right now", not a generic onboarding nag.
  why: string;
  // What answers get better once it's done — the value the customer sees.
  payoff: string;
  // Higher = do first. Only used for ranking.
  value: number;
  // Optional prefill for the tool call (e.g. which competitor to ask about).
  args?: Record<string, unknown>;
};

export type NextBestActions = {
  // 0-100: how much of the context that makes answers specific to this
  // business is in place. Deterministic, so it doesn't wobble between calls.
  contextScore: number;
  next: NextAction | null;
  alternates: NextAction[];
};

// Decides what to ask the customer for next, with no LLM call: it has to be
// fast (it rides along on every tool response) and consistent (the same
// account state should give the same ask). It ranks a small set of gaps by
// how much closing each one would sharpen the answers this account gets,
// and phrases each with the account's own data: the competitor that just
// moved, how many deals they've logged against it, how far from the
// pattern-detection threshold they are. The agent on the other end can
// re-word it conversationally; the ranking and the "why" are what's smart.
export async function computeNextBestActions(supabase: Client, accountId: string): Promise<NextBestActions> {
  const hotSince = new Date();
  hotSince.setUTCDate(hotSince.getUTCDate() - HOT_SIGNAL_WINDOW_DAYS);

  const [{ data: account }, { data: competitors }] = await Promise.all([
    supabase.from("accounts").select("positioning, icp").eq("id", accountId).single(),
    supabase.from("competitors").select("id, name").eq("account_id", accountId),
  ]);
  const competitorIds = (competitors ?? []).map((c) => c.id);

  const [{ data: hotSignals }, { data: winLoss }, { count: feedbackCount }, { count: scoredFeedbackCount }, momentum] =
    await Promise.all([
      competitorIds.length
        ? supabase
            .from("signals")
            .select("competitor_id, title, type, occurred_on")
            .in("competitor_id", competitorIds)
            .eq("relevance_level", "High")
            .gte("occurred_on", hotSince.toISOString().slice(0, 10))
            .order("occurred_on", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] }),
      supabase.from("competitor_win_loss").select("competitor_id").eq("account_id", accountId),
      supabase.from("account_customer_feedback").select("id", { count: "exact", head: true }).eq("account_id", accountId),
      supabase
        .from("account_customer_feedback")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId)
        .not("score", "is", null),
      loadCompetitorMomentum(supabase, accountId),
    ]);

  const competitorList = competitors ?? [];
  const winLossRows = winLoss ?? [];
  const totalWinLoss = winLossRows.length;
  const winLossFor = (competitorId: string) => winLossRows.filter((r) => r.competitor_id === competitorId).length;
  const totalReasons = totalWinLoss + (scoredFeedbackCount ?? 0);
  const hasPositioning = Boolean(account?.positioning?.trim());
  const hasIcp = Boolean(account?.icp?.trim());

  // Weights add to 100. Competitors and positioning are what make the very
  // first answer specific; win/loss and feedback are what make it proprietary.
  const contextScore =
    (competitorList.length > 0 ? 20 : 0) +
    (hasPositioning ? 15 : 0) +
    (hasIcp ? 15 : 0) +
    Math.round(30 * Math.min(1, totalWinLoss / MIN_REASONS_FOR_TRENDS)) +
    Math.round(20 * Math.min(1, (feedbackCount ?? 0) / 3));

  const candidates: NextAction[] = [];

  if (competitorList.length === 0) {
    candidates.push({
      id: "add-first-competitor",
      tool: "add_competitor",
      headline: "Name the competitor you lose deals to most.",
      why: "Nothing is being watched yet, so there is nothing to score or summarize.",
      payoff: "I'll start tracking their pricing, hiring, launches and press, and can give you a first read right away.",
      value: 100,
    });
  }

  if (!hasPositioning || !hasIcp) {
    const missing = [!hasPositioning ? "how you position yourself" : null, !hasIcp ? "who you sell to" : null]
      .filter(Boolean)
      .join(" and ");
    candidates.push({
      id: "set-context",
      tool: "set_context",
      headline: `Tell me ${missing} in a sentence or two.`,
      why: "Without it I judge every competitor move against a generic business instead of yours.",
      payoff: "Signals get scored for whether they threaten your deals, not just whether they're notable.",
      value: 80,
    });
  }

  // The most valuable ask: a competitor just did something that matters and
  // we know nothing about how it's playing in real deals. Pick the competitor
  // with a fresh High-relevance signal and the fewest logged deals.
  const hotByCompetitor = new Map<string, { title: string; occurredOn: string }>();
  for (const s of hotSignals ?? []) {
    if (!hotByCompetitor.has(s.competitor_id)) hotByCompetitor.set(s.competitor_id, { title: s.title, occurredOn: s.occurred_on });
  }
  const heatingUp = new Set(momentum.filter((m) => m.momentum.label === "Heating up").map((m) => m.competitor.id));
  let bestGap: { name: string; title: string | null; occurredOn: string | null; logged: number; score: number } | null = null;
  for (const c of competitorList) {
    const hot = hotByCompetitor.get(c.id);
    const isHeating = heatingUp.has(c.id);
    if (!hot && !isHeating) continue;
    const logged = winLossFor(c.id);
    if (logged >= 3) continue; // enough evidence already
    const score = 70 + (hot ? 10 : 0) + (isHeating ? 8 : 0) + (logged === 0 ? 8 : 0);
    if (!bestGap || score > bestGap.score) {
      bestGap = { name: c.name, title: hot?.title ?? null, occurredOn: hot?.occurredOn ?? null, logged, score };
    }
  }
  if (bestGap) {
    const moved = bestGap.title
      ? `${bestGap.name} recently: "${bestGap.title}" (${bestGap.occurredOn}).`
      : `${bestGap.name} is heating up.`;
    candidates.push({
      id: `win-loss-${bestGap.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      tool: "log_win_loss",
      headline: `Tell me how your last few deals against ${bestGap.name} went.`,
      why:
        `${moved} You've logged ${bestGap.logged === 0 ? "no deals" : `${bestGap.logged} deal${bestGap.logged === 1 ? "" : "s"}`} ` +
        `against them, so I can't tell whether this is costing you.`,
      payoff: `With 3 or more, I can say whether their move lines up with the deals you're losing.`,
      value: bestGap.score,
      args: { competitor_name: bestGap.name },
    });
  }

  if (totalReasons < MIN_REASONS_FOR_TRENDS && competitorList.length > 0) {
    const remaining = MIN_REASONS_FOR_TRENDS - totalReasons;
    candidates.push({
      id: "reach-trend-threshold",
      tool: "log_win_loss",
      headline: `Log ${remaining} more won or lost deal${remaining === 1 ? "" : "s"} with the reason.`,
      why: `You're at ${totalReasons} of ${MIN_REASONS_FOR_TRENDS} reasons needed before I can detect patterns.`,
      payoff: "I'll start surfacing recurring themes and tie them to what competitors changed.",
      value: 60,
    });
  }

  if ((feedbackCount ?? 0) === 0 && competitorList.length > 0) {
    candidates.push({
      id: "log-first-feedback",
      tool: "log_customer_feedback",
      headline: "Share one thing a customer said about you, with an NPS score if you have one.",
      why: "I only know what competitors are doing, not what your customers are asking for.",
      payoff: "I can compare their requests to competitor moves and show where you're exposed.",
      value: 40,
    });
  }

  // Quiet competitors are worth a nudge to look, but only once the basics are in.
  const quiet = momentum.find((m) => m.momentum.label === "Gone quiet");
  if (quiet && candidates.length === 0) {
    candidates.push({
      id: `quiet-${quiet.competitor.id}`,
      tool: "ask",
      headline: `Ask me what ${quiet.competitor.name}'s silence could mean.`,
      why: `${quiet.competitor.name} has gone quiet, which often comes before a repositioning or launch.`,
      payoff: "I'll read their last moves against your positioning and say what to watch for.",
      value: 35,
      args: { question: `${quiet.competitor.name} has gone quiet. What could that mean for us?` },
    });
  }

  candidates.sort((a, b) => b.value - a.value);
  return { contextScore, next: candidates[0] ?? null, alternates: candidates.slice(1, 3) };
}
