import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getHubspotRedirectUri, isHubspotConfigured } from "@/lib/hubspot";
import { CRM_ALLOWED } from "@/lib/tier-limits";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/app/settings", request.url));
  }

  if (!isHubspotConfigured()) {
    return NextResponse.redirect(new URL("/app/settings?error=hubspot_not_configured", request.url));
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

  if (!account || !CRM_ALLOWED[account.tier]) {
    return NextResponse.redirect(new URL("/app/settings?error=hubspot_requires_upgrade", request.url));
  }

  const state = crypto.randomUUID();
  const authorizeUrl = new URL("https://app.hubspot.com/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", process.env.HUBSPOT_CLIENT_ID!);
  authorizeUrl.searchParams.set("redirect_uri", getHubspotRedirectUri());
  authorizeUrl.searchParams.set("scope", "crm.objects.deals.read");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("hubspot_oauth_state", state, {
    httpOnly: true,
    secure: true,
    maxAge: 300,
    path: "/",
  });
  return response;
}
