import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiRequest } from "@/lib/api-auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createAdminClient();
  // Scoped by account_id, not just id — a key from one account must never
  // be able to read another account's competitor by guessing/enumerating ids.
  const { data, error } = await supabase
    .from("competitors")
    .select(
      "id, name, domain, category, pricing_url, careers_url, fact_sheet_why_we_win, fact_sheet_why_we_lose, fact_sheet_generated_at, created_at"
    )
    .eq("account_id", auth.accountId)
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Competitor not found." }, { status: 404 });
  return NextResponse.json({ data });
}
