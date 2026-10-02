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
      // Every signUp() call site passes emailRedirectTo as a full absolute
      // URL (window.location.origin + path), so `next` here is already
      // absolute — prefixing it with `origin` again produced a mangled,
      // unparseable URL (e.g. "https://a.comhttps://b.com/path"). Only a
      // bare relative path needs `origin` prepended.
      const target = /^https?:\/\//.test(next) ? next : `${origin}${next}`;
      // 303, not the default 307: this request is a POST (the form above),
      // and a 307 preserves the method on redirect — the browser would
      // replay the POST against `target`, a plain page with no POST
      // handler, and get a 405 instead of actually landing there. 303
      // forces the follow-up request to GET, which is what we want for a
      // post-form-submission redirect regardless of where it points.
      return NextResponse.redirect(target, 303);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation-failed`, 303);
}
