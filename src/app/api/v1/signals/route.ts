import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiRequest } from "@/lib/api-auth";
import type { SignalType, RelevanceLevel } from "@/lib/supabase/types";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;
const SIGNAL_TYPES: SignalType[] = ["pricing", "job_posting", "review", "news", "funding", "seo"];
const RELEVANCE_LEVELS: RelevanceLevel[] = ["High", "Medium", "Low"];

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const competitorId = url.searchParams.get("competitor_id");
  const type = url.searchParams.get("type");
  const relevanceLevel = url.searchParams.get("relevance_level");
  const since = url.searchParams.get("since");
  const limit = Math.min(Number(url.searchParams.get("limit")) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  const supabase = createAdminClient();

  // Scoped to this account's own competitors first — a signal query can
  // never accidentally cross into another account's data even if a
  // competitor_id from elsewhere is passed in.
  const { data: competitors } = await supabase
    .from("competitors")
    .select("id, name")
    .eq("account_id", auth.accountId);
  const ownedIds = new Set((competitors ?? []).map((c) => c.id));
  const nameById = Object.fromEntries((competitors ?? []).map((c) => [c.id, c.name]));

  if (competitorId && !ownedIds.has(competitorId)) {
    return NextResponse.json({ data: [], count: 0 });
  }

  let query = supabase
    .from("signals")
    .select(
      "id, competitor_id, type, title, summary, url, occurred_on, scored, relevance_level, relevance_score, relevance_reasoning, source, created_at",
      { count: "exact" }
    )
    .in("competitor_id", competitorId ? [competitorId] : Array.from(ownedIds))
    .order("occurred_on", { ascending: false })
    .range(offset, offset + limit - 1);

  if (type && SIGNAL_TYPES.includes(type as SignalType)) query = query.eq("type", type as SignalType);
  if (relevanceLevel && RELEVANCE_LEVELS.includes(relevanceLevel as RelevanceLevel)) {
    query = query.eq("relevance_level", relevanceLevel as RelevanceLevel);
  }
  if (since) query = query.gte("occurred_on", since);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = (data ?? []).map((s) => ({ ...s, competitor_name: nameById[s.competitor_id] ?? null }));
  return NextResponse.json({ data: enriched, count: count ?? enriched.length, limit, offset });
}
