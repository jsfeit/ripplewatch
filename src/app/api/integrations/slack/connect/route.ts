import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSlackRedirectUri, isSlackConfigured } from "@/lib/slack";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/app/settings", request.url));
  }

  if (!isSlackConfigured()) {
    return NextResponse.redirect(new URL("/app/settings?error=slack_not_configured", request.url));
  }

  const state = crypto.randomUUID();
  const authorizeUrl = new URL("https://slack.com/oauth/v2/authorize");
  authorizeUrl.searchParams.set("client_id", process.env.SLACK_CLIENT_ID!);
  authorizeUrl.searchParams.set("scope", "incoming-webhook,chat:write");
  authorizeUrl.searchParams.set("redirect_uri", getSlackRedirectUri());
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("slack_oauth_state", state, {
    httpOnly: true,
    secure: true,
    maxAge: 300,
    path: "/",
  });
  return response;
}
