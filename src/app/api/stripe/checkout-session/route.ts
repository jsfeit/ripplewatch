import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

// Backs the client-side "purchase" GA4 event on the settings return page —
// that page previously trusted the bare ?checkout=success query param,
// which is spoofable (anyone can type the URL) and re-fires on every page
// refresh, so ad-spend measurement (especially Google Ads' value-based
// bidding) would have been reporting phantom/duplicate conversions with no
// real dollar value attached. This confirms the session actually paid,
// server-side, and returns the real amount so the event carries a value
// Google Ads can optimize against.
export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "session_id is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    // Session IDs are unguessable, but cheap to also confirm this session
    // actually belongs to the caller's own account rather than just
    // trusting possession of the ID.
    if (session.client_reference_id && session.client_reference_id !== profile?.account_id) {
      return NextResponse.json({ error: "Session does not belong to this account." }, { status: 403 });
    }

    return NextResponse.json({
      paid: session.payment_status === "paid",
      amountTotal: session.amount_total !== null ? session.amount_total / 100 : null,
      currency: session.currency ?? "usd",
    });
  } catch {
    return NextResponse.json({ error: "Could not verify checkout session." }, { status: 400 });
  }
}
