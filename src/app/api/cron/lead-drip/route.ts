import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendLeadDripEmail } from "@/lib/resend";
import { getBannerCampaign } from "@/lib/promo-campaign";

const DAY_MS = 24 * 60 * 60 * 1000;
const STEP_1_AFTER_MS = DAY_MS; // 1 day after capture
const STEP_2_AFTER_MS = 4 * DAY_MS; // 4 days after capture
const STEP_3_AFTER_MS = 7 * DAY_MS; // 7 days after capture

// Runs once a day. Targets leads captured via the quiz or onboarding's
// early-email step (capture_point set) who never actually signed up —
// legacy rows from the old pre-launch waitlist (capture_point null) are
// excluded, since "finish signing up" isn't the right message for someone
// who joined a waitlist that no longer exists. Anyone who *did* sign up in
// the meantime (email now matches a real auth user) drops out of the query
// the same way accounts.stripe_subscription_id being set drops someone out
// of the payment-reminders cron.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  const { data: leads } = await supabase
    .from("leads")
    .select(
      "id, email, company_name, capture_point, created_at, drip_email_1_sent_at, drip_email_2_sent_at, drip_email_3_sent_at"
    )
    .not("capture_point", "is", null)
    .is("unsubscribed_at", null);

  if (!leads || leads.length === 0) {
    return NextResponse.json({ ok: true, summary: [] });
  }

  const existingEmails = new Set<string>();
  let page = 1;
  for (;;) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (!data || data.users.length === 0) break;
    for (const u of data.users) {
      if (u.email) existingEmails.add(u.email.toLowerCase());
    }
    if (data.users.length < 200) break;
    page += 1;
  }

  const promo = await getBannerCampaign();
  const now = Date.now();
  const summary: Record<string, unknown>[] = [];

  for (const lead of leads) {
    if (existingEmails.has(lead.email.toLowerCase())) continue;

    const ageMs = now - new Date(lead.created_at).getTime();
    let step: 1 | 2 | 3 | null = null;
    if (!lead.drip_email_3_sent_at && lead.drip_email_2_sent_at && ageMs >= STEP_3_AFTER_MS) {
      step = 3;
    } else if (!lead.drip_email_2_sent_at && lead.drip_email_1_sent_at && ageMs >= STEP_2_AFTER_MS) {
      step = 2;
    } else if (!lead.drip_email_1_sent_at && ageMs >= STEP_1_AFTER_MS) {
      step = 1;
    }

    if (!step) continue;

    try {
      await sendLeadDripEmail(lead.email, step, {
        leadId: lead.id,
        companyName: lead.company_name,
        capturePoint: lead.capture_point,
        appUrl,
        promo: step === 3 ? promo : null,
      });
    } catch (err) {
      console.error(`lead drip step ${step} failed for ${lead.email}:`, err);
      summary.push({ email: lead.email, step, sent: false });
      continue;
    }

    const sentAt = new Date().toISOString();
    const update =
      step === 1
        ? { drip_email_1_sent_at: sentAt }
        : step === 2
          ? { drip_email_2_sent_at: sentAt }
          : { drip_email_3_sent_at: sentAt };
    await supabase.from("leads").update(update).eq("id", lead.id);

    summary.push({ email: lead.email, step, sent: true });
  }

  return NextResponse.json({ ok: true, summary });
}
