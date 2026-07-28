import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSegmentLeads, personalize, type CampaignSegment } from "@/lib/campaigns";
import { sendCampaignEmail } from "@/lib/resend";

// Sends to the full live audience for the campaign's segment, recording
// each send so a second click can't double-send to anyone already covered.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: campaign, error } = await admin.from("email_campaigns").select("*").eq("id", id).single();
  if (error || !campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  if (campaign.sent_at) {
    return NextResponse.json({ error: "This campaign has already been sent." }, { status: 400 });
  }

  const leads = await getSegmentLeads(campaign.segment as CampaignSegment);
  if (leads.length === 0) {
    return NextResponse.json({ error: "No recipients in this segment right now." }, { status: 400 });
  }

  const results = { sent: 0, failed: 0 };
  for (const lead of leads) {
    try {
      const messageId = await sendCampaignEmail(
        lead.email,
        campaign.subject,
        personalize(campaign.body, lead)
      );
      await admin.from("email_campaign_recipients").insert({
        campaign_id: id,
        email: lead.email,
        resend_message_id: messageId,
      });
      results.sent += 1;
    } catch (err) {
      console.error(`campaign send failed for ${lead.email}:`, err);
      results.failed += 1;
    }
  }

  await admin.from("email_campaigns").update({ sent_at: new Date().toISOString() }).eq("id", id);

  return NextResponse.json({ ok: true, ...results });
}
