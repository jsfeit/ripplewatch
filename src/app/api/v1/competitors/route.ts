import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiRequest } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("competitors")
    .select("id, name, domain, category, pricing_url, careers_url, created_at")
    .eq("account_id", auth.accountId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
