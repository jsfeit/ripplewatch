import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const companyName = typeof body?.company === "string" ? body.company.trim() : "";

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!isValid) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("waitlist_signups")
    .insert({ email, company_name: companyName || null });

  // Unique violation on email — treat re-signup as success rather than an error.
  if (error && error.code !== "23505") {
    console.error("waitlist insert failed:", error);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
