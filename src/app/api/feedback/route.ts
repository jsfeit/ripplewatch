import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendFeedbackEmail } from "@/lib/resend";

// Always goes straight to the founder's inbox — same lead-capture-only
// model as the affiliate application flow, deliberately not a support
// ticket queue with its own dashboard.
const NOTIFY_EMAIL = "jeremyripplewatch@gmail.com";
const VALID_CATEGORIES = ["bug", "idea", "general"] as const;
type Category = (typeof VALID_CATEGORIES)[number];

export async function POST(request: Request) {
  // Rate-limited per signed-in user, not per IP (unlike the public affiliate
  // form) — this route requires a session, so the caller's own id is a
  // steadier key than an IP that may be shared across a whole team/office.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  if (!checkRateLimit(`feedback:${user.id}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const category: Category = VALID_CATEGORIES.includes(body?.category) ? body.category : "general";
  const pagePath = typeof body?.pagePath === "string" ? body.pagePath.slice(0, 200) : null;

  if (!message) {
    return NextResponse.json({ error: "Enter a message before sending." }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: "Keep it under 4,000 characters." }, { status: 400 });
  }

  const { data: profile } = await supabase.from("profiles").select("account_id").eq("id", user.id).single();

  const admin = createAdminClient();
  let accountName: string | null = null;
  if (profile?.account_id) {
    const { data: account } = await admin.from("accounts").select("name").eq("id", profile.account_id).single();
    accountName = account?.name ?? null;
  }

  const { error } = await admin.from("feedback_submissions").insert({
    account_id: profile?.account_id ?? null,
    submitted_by: user.id,
    submitted_by_email: user.email ?? null,
    category,
    message,
    page_path: pagePath,
  });

  if (error) {
    console.error("feedback submission insert failed:", error);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }

  sendFeedbackEmail([NOTIFY_EMAIL], {
    category,
    message,
    accountName,
    submittedByEmail: user.email ?? null,
    pagePath,
  }).catch((err) => console.error("feedback notification email failed:", err));

  return NextResponse.json({ ok: true });
}
