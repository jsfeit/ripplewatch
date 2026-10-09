import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Where "Continue with Google" lands. Google sends the person back here with a
// one-time code, which becomes a signed-in session in this request's cookies,
// then they continue to wherever they were headed. Only a path on this site is
// accepted as the destination, so the link can't be turned into an open redirect.
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  // The person pressed Cancel on Google's screen, or Google refused.
  if (url.searchParams.get("error") || !code) {
    return NextResponse.redirect(`${url.origin}/login?error=google-cancelled`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${url.origin}/login?error=google-failed`);
  }
  return NextResponse.redirect(`${url.origin}${next}`);
}
