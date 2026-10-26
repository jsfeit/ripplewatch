import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/audit";

// Disconnects an AI assistant: revokes every grant it holds. Done here, not in
// the browser, so the disconnect is recorded in the audit log.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const clientIds: string[] = Array.isArray(body?.clientIds) ? body.clientIds.filter((c: unknown) => typeof c === "string") : [];
  const name = typeof body?.name === "string" ? body.name.slice(0, 120) : "An AI assistant";
  if (clientIds.length === 0) return NextResponse.json({ error: "Nothing to disconnect." }, { status: 400 });

  const { data: profile } = await supabase.from("profiles").select("account_id").eq("id", user.id).maybeSingle();

  const results = await Promise.all(
    clientIds.map(async (clientId) => ({ clientId, error: (await supabase.auth.oauth.revokeGrant({ clientId })).error }))
  );
  const revoked = results.filter((r) => !r.error).map((r) => r.clientId);

  if (revoked.length > 0 && profile?.account_id) {
    await recordAudit({
      accountId: profile.account_id,
      actorType: "user",
      actorId: user.id,
      actorLabel: user.email ?? null,
      action: "assistant.disconnected",
      target: name,
      headers: request.headers,
    });
  }

  return NextResponse.json({ revoked, failed: results.filter((r) => r.error).map((r) => r.clientId) });
}
