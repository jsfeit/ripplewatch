import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getZoomRedirectUri, isZoomConfigured } from "@/lib/zoom";
import { CALL_INTEL_ALLOWED } from "@/lib/tier-limits";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/app/settings", request.url));
  }

  if (!isZoomConfigured()) {
    return NextResponse.redirect(new URL("/app/settings?error=zoom_not_configured", request.url));
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
    return NextResponse.redirect(new URL("/app/settings?error=zoom_requires_upgrade", request.url));
  }

  const state = crypto.randomUUID();
  const authorizeUrl = new URL("https://zoom.us/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", process.env.ZOOM_CLIENT_ID!);
  authorizeUrl.searchParams.set("redirect_uri", getZoomRedirectUri());
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("zoom_oauth_state", state, {
    httpOnly: true,
    secure: true,
    maxAge: 300,
    path: "/",
  });
  return response;
}
