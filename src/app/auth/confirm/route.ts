import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Every email-based auth link (signup confirmation, password reset, etc.)
// routes through here instead of straight to Supabase's own /verify
// endpoint. That endpoint redirects with the session in a URL fragment,
// which the server never sees (fragments aren't sent in HTTP requests), so
// a destination page's server-rendered auth state stayed stale until a
// manual reload — the confirm-your-email screen never noticed the user had
// actually confirmed. Verifying the token here sets real cookies before we
// redirect, so the destination always renders already signed in.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation-failed`);
}
