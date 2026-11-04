import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { loadCompetitorMomentum } from "@/lib/momentum-account";
import { loadAllDeals } from "@/lib/deal-store";
import { computeImpactFacts, type ImpactFacts } from "@/lib/deal-impact-facts";
import { generateImpactFindings, type ImpactFinding } from "@/lib/deal-llm";
import { listContextNotes } from "@/lib/context-notes";
import type { DealCoverage } from "@/lib/deal-coverage";

type Admin = SupabaseClient<Database>;

// Below this many deals with a reason there is nothing honest to say beyond "add more".
const MIN_DEALS_FOR_FINDINGS = 8;
// A brief is reused while the inputs are unchanged, up to this long.
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;

export type DealImpactBrief = {
  coverage: DealCoverage;
  findings: ImpactFinding[];
  generatedAt: string | null;
  // Set when findings are empty so the caller can say why and what to do about it.
  note: string | null;
  facts: ImpactFacts;
};

export async function loadImpactFacts(supabase: Admin, accountId: string): Promise<ImpactFacts> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 180);
  const [deals, notes, momentum, { data: competitors }] = await Promise.all([
    loadAllDeals(supabase, accountId),
    listContextNotes(supabase, accountId, 40),
    loadCompetitorMomentum(supabase, accountId),
    supabase.from("competitors").select("id, name").eq("account_id", accountId),
  ]);
  const comps = competitors ?? [];
  const { data: signals } = comps.length
    ? await supabase
        .from("signals")
        .select("competitor_id, type, title, occurred_on, relevance_score")
        .in("competitor_id", comps.map((c) => c.id))
        .gte("occurred_on", since.toISOString().slice(0, 10))
        .order("occurred_on", { ascending: false })
        .limit(400)
    : { data: [] };

  return computeImpactFacts({
    today: new Date().toISOString().slice(0, 10),
    deals,
    competitors: comps,
    signals: signals ?? [],
    momentum: momentum.map((m) => ({ competitorId: m.competitor.id, label: m.momentum.label, score: m.momentum.score })),
    notes,
  });
}

// What is costing this account deals: reasons first, competitor moves as candidate explanations, their
// own roadmap and notes lined up against both, and Momentum for the competitors involved. The facts
// are computed in code; the model only interprets them. Cached by a hash of the facts.
export async function getDealImpactBrief(supabase: Admin, accountId: string, opts: { refresh?: boolean } = {}): Promise<DealImpactBrief> {
  const facts = await loadImpactFacts(supabase, accountId);

  if (facts.coverage.dealCount < MIN_DEALS_FOR_FINDINGS) {
    return {
      coverage: facts.coverage,
      findings: [],
      generatedAt: null,
      note:
        facts.coverage.dealCount === 0
          ? facts.coverage.message
          : `Only ${facts.coverage.dealCount} deal${facts.coverage.dealCount === 1 ? "" : "s"} so far, which is too few to find a pattern. ${facts.coverage.message}`,
      facts,
    };
  }

  // Date-only hash input: facts embed today's date, which would otherwise defeat the cache daily.
  const { today: _today, ...stable } = facts;
  void _today;
  const inputHash = createHash("sha1").update(JSON.stringify(stable)).digest("hex");

  if (!opts.refresh) {
    const { data: cached } = await supabase
      .from("deal_impact_briefs")
      .select("findings, input_hash, generated_at")
      .eq("account_id", accountId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cached && cached.input_hash === inputHash && Date.now() - new Date(cached.generated_at).getTime() < CACHE_MS) {
      return { coverage: facts.coverage, findings: cached.findings as ImpactFinding[], generatedAt: cached.generated_at, note: null, facts };
    }
  }

  const findings = await generateImpactFindings(facts, accountId);
  const generatedAt = new Date().toISOString();
  await supabase.from("deal_impact_briefs").insert({
    account_id: accountId,
    findings,
    coverage: facts.coverage,
    input_hash: inputHash,
    generated_at: generatedAt,
  });
  return {
    coverage: facts.coverage,
    findings,
    generatedAt,
    note: findings.length === 0 ? "Nothing in the deal data stood out yet. More deals, a longer date range, or reasons on more of them would help." : null,
    facts,
  };
}
