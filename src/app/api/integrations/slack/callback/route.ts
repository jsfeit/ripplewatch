import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exchangeSlackCode } from "@/lib/slack";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("slack_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/app/settings?error=slack_state_mismatch", request.url));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();
  if (!profile?.account_id) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  try {
    const credentials = await exchangeSlackCode(code);
    await supabase.from("integrations").upsert(
      {
        account_id: profile.account_id,
        provider: "slack" as const,
        connected: true,
        connected_at: new Date().toISOString(),
        credentials,
        external_account_id: credentials.team_id,
      },
      { onConflict: "account_id,provider" }
    );
  } catch {
    return NextResponse.redirect(new URL("/app/settings?error=slack_exchange_failed", request.url));
  }

  // Back to where the person started (the setup wizard sends them to the Data
  // tab), with the same marker so Settings can say it worked.
  const returnTo = cookieStore.get("slack_oauth_next")?.value;
  const target = new URL(returnTo?.startsWith("/app/settings") ? returnTo : "/app/settings", request.url);
  target.searchParams.set("connected", "slack");
  const response = NextResponse.redirect(target);
  response.cookies.delete("slack_oauth_state");
  response.cookies.delete("slack_oauth_next");
  return response;
}
