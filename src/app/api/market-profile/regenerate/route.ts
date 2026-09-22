import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAccountContext } from "@/lib/impersonation";
import { runMarketProfileForAccount } from "@/lib/market-profile";
import { checkRateLimit } from "@/lib/rate-limit";

// Web-search-grounded, so this can take 10-20s — the dashboard button shows
// a loading state for the duration rather than firing and polling.
export const maxDuration = 60;

// A member explicitly asking for a fresh pull — the one path back into the
// monthly auto-refresh cycle after a manual edit (see PATCH /api/market-profile
// and runMarketProfileForAccount's skipIfUserEdited): this always
// regenerates and clears user_edited_at, overwriting any edit on purpose.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { accountId } = await resolveAccountContext(supabase, user.id);
  if (!accountId) return NextResponse.json({ error: "Finish onboarding first." }, { status: 400 });

  // Web search is real spend — a few clicks in a row shouldn't run it
  // repeatedly. Per account, not per user, since a regenerate benefits the
  // whole account regardless of who clicked it.
  if (!checkRateLimit(`market-profile-regenerate:${accountId}`, 3, 60 * 60_000)) {
    return NextResponse.json({ error: "Already regenerated recently. Try again in a bit." }, { status: 429 });
  }

  const admin = createAdminClient();
  const [{ data: account }, { data: competitors }] = await Promise.all([
    admin.from("accounts").select("*").eq("id", accountId).single(),
    admin.from("competitors").select("name").eq("account_id", accountId),
  ]);
  if (!account) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const result = await runMarketProfileForAccount(
    admin,
    account,
    (competitors ?? []).map((c) => c.name)
  );

  if (!result.generated) {
    return NextResponse.json({ error: result.error ?? "Couldn't regenerate right now. Try again shortly." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
