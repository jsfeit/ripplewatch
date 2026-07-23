import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGongRedirectUri, isGongConfigured } from "@/lib/gong";
import { CALL_INTEL_ALLOWED } from "@/lib/tier-limits";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/app/settings", request.url));
  }

  if (!isGongConfigured()) {
    return NextResponse.redirect(new URL("/app/settings?error=gong_not_configured", request.url));
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

  if (!account || !CALL_INTEL_ALLOWED[account.tier]) {
    return NextResponse.redirect(new URL("/app/settings?error=gong_requires_upgrade", request.url));
  }

  const state = crypto.randomUUID();
  const authorizeUrl = new URL("https://app.gong.io/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", process.env.GONG_CLIENT_ID!);
  authorizeUrl.searchParams.set("redirect_uri", getGongRedirectUri());
  authorizeUrl.searchParams.set("scope", "api:calls:read:basic api:calls:read:extensive");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("response_type", "code");

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("gong_oauth_state", state, {
    httpOnly: true,
    secure: true,
    maxAge: 300,
    path: "/",
  });
  return response;
}
