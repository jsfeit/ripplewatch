import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateApiKey } from "@/lib/api-keys";
import { API_ACCESS_ALLOWED } from "@/lib/tier-limits";

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

  const { data: account } = await supabase.from("accounts").select("tier").eq("id", profile.account_id).single();
  if (!account || !API_ACCESS_ALLOWED[account.tier]) {
    return NextResponse.json({ error: "API access requires the Plus or Advanced plan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim().slice(0, 60) : "API key";

  const generated = generateApiKey();
  // RLS scopes this insert to the caller's own account (auth_account_id()).
  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      account_id: profile.account_id,
      name,
      key_hash: generated.hash,
      key_prefix: generated.displayPrefix,
      created_by: user.id,
    })
    .select("id, name, key_prefix, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // The only response that will ever contain the plaintext key — it is
  // never stored, so this is the caller's one chance to copy it.
  return NextResponse.json({ key: generated.plaintext, ...data });
}
