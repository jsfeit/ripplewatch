import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { computeNextBestActions, type NextBestActions } from "@/lib/next-best-action";

type Client = SupabaseClient<Database>;

export type CrawlState = "none" | "running" | "ready";

export type FirstLook = {
  companyName: string;
  competitors: string[];
  crawl: { state: CrawlState; done: number; total: number };
  topSignals: { competitor: string | null; title: string; why: string | null; date: string }[];
  starterPrompts: string[];
  next: NextBestActions;
};

// Prompts a brand-new customer can paste or say as-is. Built from the
// account's own competitor names so the very first thing they try already
// sounds like their market, not a demo. Deterministic on purpose: it has to
// be instant and identical between the assistant and the web app.
export function buildStarterPrompts(competitors: string[], hasWinLoss: boolean): string[] {
  const [first, second] = competitors;
  if (!first) {
    return [
      "Start tracking the competitor we lose deals to most.",
      "What can you tell me about my competitors?",
    ];
  }
  const prompts = [
    `What changed at ${first} in the last two weeks, and does it matter to us?`,
    "Which of my competitors is heating up the most right now?",
    second
      ? `How does ${first}'s pricing compare to ${second}'s?`
      : `Should we be worried about ${first}'s latest move?`,
    `Write a short battlecard I can use when a prospect brings up ${first}.`,
  ];
  if (!hasWinLoss) prompts.push(`I want to log a recent deal I won or lost against ${first}.`);
  return prompts;
}

// What a new customer needs to see in their first few minutes: that the
// product is already working on their competitors (crawl progress), the best
// early findings once there are any, and prompts to try. Shared by the MCP
// start_here tool and the Settings "first look" card so both say the same
// thing.
export async function loadFirstLook(supabase: Client, accountId: string): Promise<FirstLook> {
  const [{ data: account }, { data: competitors }, { data: run }, next, { count: winLossCount }] = await Promise.all([
    supabase.from("accounts").select("name").eq("id", accountId).single(),
    supabase.from("competitors").select("id, name").eq("account_id", accountId).order("created_at", { ascending: true }),
    supabase
      .from("crawl_runs")
      .select("id, total_jobs")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    computeNextBestActions(supabase, accountId),
    supabase.from("competitor_win_loss").select("id", { count: "exact", head: true }).eq("account_id", accountId),
  ]);

  const competitorRows = competitors ?? [];
  const nameById = new Map(competitorRows.map((c) => [c.id, c.name]));

  let crawl: FirstLook["crawl"] = { state: "none", done: 0, total: 0 };
  if (run) {
    const { data: jobs } = await supabase.from("crawl_jobs").select("status").eq("run_id", run.id);
    const total = run.total_jobs || jobs?.length || 0;
    const finished = (jobs ?? []).filter((j) => j.status === "done" || j.status === "error").length;
    crawl = { state: total > 0 && finished >= total ? "ready" : "running", done: Math.min(finished, total), total };
  }

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const { data: signals } = nameById.size
    ? await supabase
        .from("signals")
        .select("competitor_id, title, relevance_reasoning, occurred_on")
        .in("competitor_id", Array.from(nameById.keys()))
        .in("relevance_level", ["High", "Medium"])
        .gte("occurred_on", since.toISOString().slice(0, 10))
        .order("relevance_score", { ascending: false })
        .limit(3)
    : { data: [] };

  return {
    companyName: account?.name ?? "your company",
    competitors: competitorRows.map((c) => c.name),
    crawl,
    topSignals: (signals ?? []).map((s) => ({
      competitor: nameById.get(s.competitor_id) ?? null,
      title: s.title,
      why: s.relevance_reasoning,
      date: s.occurred_on,
    })),
    starterPrompts: buildStarterPrompts(
      competitorRows.map((c) => c.name),
      (winLossCount ?? 0) > 0
    ),
    next,
  };
}
