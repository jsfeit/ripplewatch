import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPasswordResetEmail } from "@/lib/resend";

// Replaces supabase.auth.resetPasswordForEmail() (which triggers Supabase
// Auth's own built-in email, sent as "Supabase Auth <noreply@mail.app.
// supabase.io>" with generic unbranded copy) with generateLink() + our own
// Resend send, so this reads like every other Ripplewatch email instead of
// a raw Supabase default.
//
// Always responds the same way regardless of whether the email matched a
// real account — generateLink() itself errors on an unknown email, unlike
// resetPasswordForEmail()'s deliberately silent behavior, so that error is
// swallowed here rather than surfaced, to avoid leaking which emails have
// accounts.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const supabase = createAdminClient();

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${appUrl}/reset-password` },
  });

  if (!error && data.properties?.action_link) {
    try {
      await sendPasswordResetEmail(email, data.properties.action_link);
    } catch (err) {
      console.error("password reset email failed:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
