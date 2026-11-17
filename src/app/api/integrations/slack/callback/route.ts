import { recordAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exchangeSlackCode } from "@/lib/slack";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // Slack sends the person back with ?error= when they cancel, or when the workspace blocks the app,
  // with no code. That is not an expired session, so say what actually happened.
  const slackError = url.searchParams.get("error");
  if (slackError) {
    const code = slackError === "access_denied" ? "slack_cancelled" : "slack_blocked";
    return NextResponse.redirect(new URL(`/app/settings?tab=manage&error=${code}`, request.url));
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("slack_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/app/settings?tab=manage&error=slack_state_mismatch", request.url));
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
    await recordAudit({
      accountId: profile.account_id,
      actorType: "user",
      actorId: user.id,
      actorLabel: user.email ?? null,
      action: "integration.connected",
      target: "Slack",
      headers: request.headers,
    });
  } catch {
    return NextResponse.redirect(new URL("/app/settings?tab=manage&error=slack_exchange_failed", request.url));
  }

  // Back to where the person started (the setup wizard sends them to the Data
  // tab), with the same marker so Settings can say it worked.
  const returnTo = cookieStore.get("slack_oauth_next")?.value;
  const target = new URL(returnTo?.startsWith("/app/settings") ? returnTo : "/app/settings?tab=manage", request.url);
  target.searchParams.set("connected", "slack");
  const response = NextResponse.redirect(target);
  response.cookies.delete("slack_oauth_state");
  response.cookies.delete("slack_oauth_next");
  return response;
}
