import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSegmentLeads, type CampaignSegment } from "@/lib/campaigns";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: campaign, error } = await admin.from("email_campaigns").select("*").eq("id", id).single();
  if (error || !campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  const { data: recipients } = await admin
    .from("email_campaign_recipients")
    .select("*")
    .eq("campaign_id", id)
    .order("sent_at", { ascending: false });

  const leads = campaign.sent_at ? [] : await getSegmentLeads(campaign.segment as CampaignSegment);

  return NextResponse.json({ campaign, recipients: recipients ?? [], pendingLeads: leads });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: campaign } = await admin.from("email_campaigns").select("sent_at").eq("id", id).single();
  if (campaign?.sent_at) {
    return NextResponse.json({ error: "Can't delete a campaign that's already been sent." }, { status: 400 });
  }

  await admin.from("email_campaigns").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
