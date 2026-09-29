import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The actual verification step, reached only by submitting the button on
// /auth/confirm — never by a bare page load. See that page for why: a GET
// link that verifies on load gets consumed by email providers' link
// scanners before the person clicks it, burning the one-time token. This is
// a POST-only route precisely so a scanner's GET can't trigger it.
export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);
  const formData = await request.formData();
  const token_hash = formData.get("token_hash");
  const type = formData.get("type") as EmailOtpType | null;
  const next = (formData.get("next") as string | null) ?? "/";

  if (typeof token_hash === "string" && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation-failed`);
}
