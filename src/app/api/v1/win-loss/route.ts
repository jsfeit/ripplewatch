import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiRequest } from "@/lib/api-auth";
import { applyExtractedWinLossEntries } from "@/lib/win-loss-import";
import type { ExtractedWinLossEntry } from "@/lib/anthropic";

// Structured counterpart to the CSV-paste/HubSpot-sync import flow: a
// customer's own CRM pushes one deal at a time the moment it closes,
// instead of someone remembering to export and paste a file. Deliberately
// skips the LLM extraction step those two use — a caller here already
// knows the competitor name and outcome, so there's nothing to infer from
// unstructured text. Matching is exact (case-insensitive) against the
// account's tracked competitor names, same as extractWinLossEntries'
// own "tracked" rule (no fuzzy matching there either); a name that doesn't
// match becomes a suggested competitor via the same shared apply logic the
// CSV import uses, rather than silently rejected.
export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const competitorName = typeof body?.competitor_name === "string" ? body.competitor_name.trim() : "";
  const outcome = body?.outcome === "won" || body?.outcome === "lost" ? body.outcome : null;
  const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : null;

  if (!competitorName) {
    return NextResponse.json({ error: "competitor_name is required." }, { status: 400 });
  }
  if (!outcome) {
    return NextResponse.json({ error: "outcome must be \"won\" or \"lost\"." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: competitors } = await supabase
    .from("competitors")
    .select("id, name")
    .eq("account_id", auth.accountId);

  if (!competitors || competitors.length === 0) {
    return NextResponse.json({ error: "Add a competitor before submitting win/loss data." }, { status: 400 });
  }

  const tracked = competitors.find((c) => c.name.toLowerCase() === competitorName.toLowerCase());

  const entry: ExtractedWinLossEntry = tracked
    ? { matchType: "tracked", competitor: tracked.name, outcome, reason }
    : { matchType: "untracked", competitor: competitorName, outcome, reason };

  const result = await applyExtractedWinLossEntries(supabase, auth.accountId, null, competitors, [entry]);

  return NextResponse.json({
    matched: Boolean(tracked),
    imported: result.imported,
    skipped: result.skipped,
    suggestedCompetitors: result.suggestedCompetitors,
  });
}
