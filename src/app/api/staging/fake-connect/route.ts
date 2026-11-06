import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Staging only: stands in for a real assistant signing in, so the screens after connecting can be
// looked at without one. Marks the signed-in user's own account as connected, the same field a real
// /api/mcp request sets. Refuses everywhere except the staging branch's deployment.
export async function POST() {
  if (process.env.VERCEL_GIT_COMMIT_REF !== "staging") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("account_id").eq("id", user.id).single();
  if (!profile?.account_id) return NextResponse.json({ error: "No account" }, { status: 400 });

  const { error } = await createAdminClient()
    .from("accounts")
    .update({ mcp_last_connected_at: new Date().toISOString() })
    .eq("id", profile.account_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
