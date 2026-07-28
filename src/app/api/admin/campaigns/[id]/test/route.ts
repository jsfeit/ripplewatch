import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCampaignEmail } from "@/lib/resend";
import { personalize } from "@/lib/campaigns";

// Sends the campaign to the requesting admin's own email only — never
// touches the real audience or the recipients table.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: campaign, error } = await admin.from("email_campaigns").select("*").eq("id", id).single();
  if (error || !campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  try {
    await sendCampaignEmail(
      user.email,
      `[TEST] ${campaign.subject}`,
      personalize(campaign.body, { email: user.email, companyName: "Test Co" })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send test email.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
