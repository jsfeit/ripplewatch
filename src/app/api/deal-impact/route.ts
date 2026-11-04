import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/route-account";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDealImpactBrief } from "@/lib/deal-impact";

export const maxDuration = 120;

// Builds (or reuses, when nothing changed) the "what is costing us deals" read. Briefs are written with
// the service role after the caller's account is confirmed.
export async function POST(request: Request) {
  const auth = await requireAccount();
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null);
  const brief = await getDealImpactBrief(createAdminClient(), auth.accountId, { refresh: Boolean(body?.refresh) });
  return NextResponse.json({
    coverage: brief.coverage,
    findings: brief.findings,
    generatedAt: brief.generatedAt,
    note: brief.note,
  });
}
