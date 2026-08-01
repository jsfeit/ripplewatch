import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getIntercomRedirectUri, isIntercomConfigured } from "@/lib/intercom";
import { INTERCOM_ALLOWED } from "@/lib/tier-limits";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/app/settings", request.url));
  }

  if (!isIntercomConfigured()) {
    return NextResponse.redirect(new URL("/app/settings?error=intercom_not_configured", request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();
  if (!profile?.account_id) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("tier")
    .eq("id", profile.account_id)
    .single();

  if (!account || !INTERCOM_ALLOWED[account.tier]) {
    return NextResponse.redirect(new URL("/app/settings?error=intercom_requires_upgrade", request.url));
  }

  const state = crypto.randomUUID();
  const authorizeUrl = new URL("https://app.intercom.com/oauth");
  authorizeUrl.searchParams.set("client_id", process.env.INTERCOM_CLIENT_ID!);
  authorizeUrl.searchParams.set("redirect_uri", getIntercomRedirectUri());
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("intercom_oauth_state", state, {
    httpOnly: true,
    secure: true,
    maxAge: 300,
    path: "/",
  });
  return response;
}
