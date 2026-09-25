import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiRequest } from "@/lib/api-auth";
import { logWinLoss } from "@/lib/win-loss-log";

// Structured counterpart to the CSV-paste/HubSpot-sync import flow: a
// customer's own CRM pushes one deal at a time the moment it closes,
// instead of someone remembering to export and paste a file. The matching
// and Momentum-payoff logic lives in logWinLoss, shared with the MCP
// log_win_loss tool.
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

  const result = await logWinLoss(createAdminClient(), auth.accountId, { competitorName, outcome, reason });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    matched: result.matched,
    imported: result.imported,
    skipped: result.skipped,
    suggestedCompetitors: result.suggestedCompetitors,
    momentum: result.momentum,
  });
}
