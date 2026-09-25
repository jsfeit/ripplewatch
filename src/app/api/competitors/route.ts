import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountContext } from "@/lib/impersonation";
import { createAdminClient } from "@/lib/supabase/admin";
import { addCompetitor } from "@/lib/competitor-add";
import { reviewNewCompetitor } from "@/lib/competitor-intake";

// The domain check (a couple of fetches plus look-alike suggestions) and the
// background review that follows both run inside this function's lifetime.
export const maxDuration = 120;

// Scoped to the caller's own account via RLS, except during an admin "View
// as" session (resolveAccountContext swaps in the impersonated account and
// an RLS-bypassing client) — unlike /api/admin/competitors, this never
// touches an account the caller doesn't own or isn't impersonating even if
// account_id were spoofed.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { accountId, db } = await resolveAccountContext(supabase, user.id);
  if (!accountId) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const domain = typeof body?.domain === "string" ? body.domain.trim() : "";

  // Plan cap, domain check, URL discovery and the insert all live in
  // addCompetitor, shared with the MCP add_competitor tool.
  const result = await addCompetitor(db, accountId, { name, domain, force: body?.force === true });
  if (!result.ok) {
    if (result.status === 409) {
      return NextResponse.json(
        {
          needsConfirmation: result.needsConfirmation,
          reachability: result.reachability,
          title: result.title,
          alternates: result.alternates,
          error: result.error,
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Off the request path: try to read the competitor the way the snapshot
  // does, and queue a manual follow-up (plus an alert) if we can't.
  after(() =>
    reviewNewCompetitor(
      createAdminClient(),
      result.competitor,
      process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
    )
  );

  return NextResponse.json({ competitor: result.competitor, notice: result.notice });
}
