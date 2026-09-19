import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAccountContext } from "@/lib/impersonation";
import { featurePath } from "@/lib/activity";

// Records a sign-in or an in-app page view for the signed-in user. Always
// answers 204: this is telemetry, and a failure to log must never surface in
// the product. Admin "view as" sessions are skipped so an operator poking
// around doesn't look like customer usage.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const kind = body?.kind === "login" || body?.kind === "view" ? body.kind : null;
  if (!kind) return new NextResponse(null, { status: 204 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 204 });

  const { accountId, impersonation } = await resolveAccountContext(supabase, user.id);
  if (impersonation) return new NextResponse(null, { status: 204 });

  let path: string | null = null;
  if (kind === "view") {
    path = typeof body.path === "string" ? featurePath(body.path) : null;
    if (!path) return new NextResponse(null, { status: 204 });
  }

  const { error } = await createAdminClient()
    .from("user_activity")
    .insert({ user_id: user.id, account_id: accountId, kind, path });
  if (error) console.error("user_activity insert failed:", error.message);
  return new NextResponse(null, { status: 204 });
}
