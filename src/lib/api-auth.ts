import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey, looksLikeApiKey } from "@/lib/api-keys";
import { API_ACCESS_ALLOWED } from "@/lib/tier-limits";

// Fixed 60s window, reset lazily on the next request past it rather than a
// cron sweep — correct across serverless instances without an external
// store, at the request volume this is actually expected to see.
const RATE_LIMIT_PER_MINUTE = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

export type ApiAuthResult =
  | { ok: true; accountId: string }
  | { ok: false; response: NextResponse };

// Every /api/v1/* route calls this first. A request carries only a bearer
// token, no Supabase session — RLS can't scope this lookup, so it goes
// through the service-role client and enforces account scoping explicitly
// in every subsequent query the route makes with the returned accountId.
export async function authenticateApiRequest(request: Request): Promise<ApiAuthResult> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";

  if (!token || !looksLikeApiKey(token)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Missing or malformed API key." }, { status: 401 }),
    };
  }

  const supabase = createAdminClient();
  const keyHash = hashApiKey(token);
  const { data: key } = await supabase
    .from("api_keys")
    .select("id, account_id, revoked_at, rate_limit_window_started_at, rate_limit_count")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (!key) {
    return { ok: false, response: NextResponse.json({ error: "Invalid or revoked API key." }, { status: 401 }) };
  }

  // Re-checked at request time, not just key-creation time — a downgrade
  // after the key was issued should cut off access immediately, not just
  // block creating new keys going forward.
  const { data: account } = await supabase.from("accounts").select("tier").eq("id", key.account_id).single();
  if (!account || !API_ACCESS_ALLOWED[account.tier]) {
    return {
      ok: false,
      response: NextResponse.json({ error: "API access requires the Plus or Advanced plan." }, { status: 403 }),
    };
  }

  const now = Date.now();
  const windowStart = key.rate_limit_window_started_at ? new Date(key.rate_limit_window_started_at).getTime() : 0;
  const windowExpired = now - windowStart > RATE_LIMIT_WINDOW_MS;
  const nextCount = windowExpired ? 1 : key.rate_limit_count + 1;

  if (!windowExpired && nextCount > RATE_LIMIT_PER_MINUTE) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 }),
    };
  }

  await supabase
    .from("api_keys")
    .update({
      last_used_at: new Date().toISOString(),
      rate_limit_window_started_at: windowExpired ? new Date().toISOString() : key.rate_limit_window_started_at,
      rate_limit_count: nextCount,
    })
    .eq("id", key.id);

  return { ok: true, accountId: key.account_id };
}
