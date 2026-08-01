import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exchangeIntercomCode } from "@/lib/intercom";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("intercom_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/app/settings?error=intercom_state_mismatch", request.url));
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
    const credentials = await exchangeIntercomCode(code);
    await supabase.from("integrations").upsert(
      {
        account_id: profile.account_id,
        provider: "intercom" as const,
        connected: true,
        connected_at: new Date().toISOString(),
        credentials,
      },
      { onConflict: "account_id,provider" }
    );
  } catch {
    return NextResponse.redirect(new URL("/app/settings?error=intercom_exchange_failed", request.url));
  }

  const response = NextResponse.redirect(new URL("/app/settings?connected=intercom", request.url));
  response.cookies.delete("intercom_oauth_state");
  return response;
}
