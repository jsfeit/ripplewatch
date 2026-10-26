import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/audit";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // RLS scopes this to the caller's own account — no explicit ownership
  // check needed beyond being signed in.
  const { data: revoked, error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .select("account_id, name")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (revoked) {
    await recordAudit({
      accountId: revoked.account_id,
      actorType: "user",
      actorId: user.id,
      actorLabel: user.email ?? null,
      action: "api_key.revoked",
      target: revoked.name,
      headers: request.headers,
    });
  }
  return NextResponse.json({ ok: true });
}
