import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const competitorId = typeof body?.competitor_id === "string" ? body.competitor_id : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";

  if (!competitorId || !title) {
    return NextResponse.json({ error: "competitor_id and title are required." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("signals")
    .insert({
      competitor_id: competitorId,
      type: body.type,
      title,
      summary: body.summary?.trim() || null,
      occurred_on: body.occurred_on || undefined,
      scored: Boolean(body.scored),
      relevance_level: body.scored ? body.relevance_level : null,
      relevance_reasoning: body.scored ? body.relevance_reasoning?.trim() || null : null,
      source: "manual",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ signal: data });
}
