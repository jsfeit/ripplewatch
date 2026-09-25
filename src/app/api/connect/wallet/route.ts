import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONNECT_MIN_FUNDING_USD } from "@/lib/connect-pricing";

const THRESHOLDS_USD = [5, 10, 25, 50];
const MAX_RELOAD_USD = 10_000;

// Auto-reload preferences for a Ripplewatch Connect wallet: on or off, how much
// to add, and the balance that triggers it. Turning it back on also clears a
// previous failure (the customer is saying the card is sorted); if it fails
// again it just switches itself off again. Written with the service role: the
// wallet table has no customer write policy on purpose.
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("account_id").eq("id", user.id).single();
  if (!profile?.account_id) return NextResponse.json({ error: "No account." }, { status: 400 });

  const admin = createAdminClient();
  const { data: account } = await admin.from("accounts").select("tier").eq("id", profile.account_id).single();
  if (account?.tier !== "connect") return NextResponse.json({ error: "Not a Ripplewatch Connect account." }, { status: 400 });

  const body = await request.json().catch(() => null);
  const update: {
    account_id: string;
    auto_reload_enabled?: boolean;
    reload_amount_cents?: number;
    reload_threshold_cents?: number;
    reload_failed_at?: string | null;
  } = { account_id: profile.account_id };

  if (typeof body?.autoReloadEnabled === "boolean") {
    update.auto_reload_enabled = body.autoReloadEnabled;
    if (body.autoReloadEnabled) update.reload_failed_at = null;
  }
  if (body?.reloadAmountUsd !== undefined) {
    const n = Number(body.reloadAmountUsd);
    if (!Number.isInteger(n) || n < CONNECT_MIN_FUNDING_USD || n > MAX_RELOAD_USD) {
      return NextResponse.json({ error: `Reload amount must be a whole number from $${CONNECT_MIN_FUNDING_USD} up.` }, { status: 400 });
    }
    update.reload_amount_cents = n * 100;
  }
  if (body?.reloadThresholdUsd !== undefined) {
    const n = Number(body.reloadThresholdUsd);
    if (!THRESHOLDS_USD.includes(n)) return NextResponse.json({ error: "Choose a reload threshold from the list." }, { status: 400 });
    update.reload_threshold_cents = n * 100;
  }

  const { error } = await admin.from("connect_wallets").upsert(update, { onConflict: "account_id" });
  if (error) {
    console.error("connect wallet settings update failed:", error.message);
    return NextResponse.json({ error: "Could not save that." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
