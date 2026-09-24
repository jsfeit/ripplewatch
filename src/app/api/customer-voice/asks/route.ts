import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("account_id").eq("id", user.id).single();
  if (!profile?.account_id) {
    return NextResponse.json({ error: "No account." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const summary = typeof body?.summary === "string" ? body.summary.trim() : "";
  const source = typeof body?.source === "string" && body.source.trim() ? body.source.trim() : null;
  if (!summary) {
    return NextResponse.json({ error: "Enter what the customer asked for." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("account_customer_asks")
    .insert({ account_id: profile.account_id, summary, source, status: "new", created_by: user.id })
    .select("id, summary, source, status, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ask: data });
}
