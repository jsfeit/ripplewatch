import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { suggestCompetitorCategories } from "@/lib/anthropic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const accountId = typeof body?.account_id === "string" ? body.account_id : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const domain = typeof body?.domain === "string" ? body.domain.trim() : "";

  if (!accountId || !name) {
    return NextResponse.json({ error: "account_id and name are required." }, { status: 400 });
  }

  const [category] = await suggestCompetitorCategories([{ name, domain: domain || null }], accountId).catch(
    () => [""]
  );

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("competitors")
    .insert({ account_id: accountId, name, domain: domain || null, category: category || null })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ competitor: data });
}
