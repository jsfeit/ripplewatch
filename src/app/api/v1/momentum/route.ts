import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiRequest } from "@/lib/api-auth";
import { loadCompetitorMomentum } from "@/lib/momentum-account";

// Same computeMomentum call the Trends page uses — deterministic, no LLM
// cost, so this is cheap to serve on every request. The loading and
// lookback logic lives in loadCompetitorMomentum so the MCP tools read the
// exact same numbers.
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const results = await loadCompetitorMomentum(createAdminClient(), auth.accountId);
  const data = results.map(({ competitor, momentum }) => ({
    competitor_id: competitor.id,
    competitor_name: competitor.name,
    score: momentum.score,
    label: momentum.label,
  }));

  return NextResponse.json({ data });
}
