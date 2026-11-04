import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The signed-in user's account for a route handler, or the response to return when there is none.
export async function requireAccount(): Promise<
  | { ok: true; accountId: string; userId: string; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("account_id").eq("id", user.id).single();
  if (!profile?.account_id) return { ok: false, response: NextResponse.json({ error: "No account." }, { status: 400 }) };
  return { ok: true, accountId: profile.account_id, userId: user.id, supabase };
}
