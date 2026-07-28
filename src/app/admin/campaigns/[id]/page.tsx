import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSegmentLeads, SEGMENT_LABELS, type CampaignSegment } from "@/lib/campaigns";
import { isResendConfigured } from "@/lib/resend";
import { CampaignDetailView } from "@/components/admin/campaign-detail-view";

export const dynamic = "force-dynamic";

export default async function AdminCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: campaign } = await admin.from("email_campaigns").select("*").eq("id", id).single();
  if (!campaign) notFound();

  const { data: recipients } = await admin
    .from("email_campaign_recipients")
    .select("*")
    .eq("campaign_id", id)
    .order("sent_at", { ascending: false });

  const pendingLeads = campaign.sent_at ? [] : await getSegmentLeads(campaign.segment as CampaignSegment);

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {SEGMENT_LABELS[campaign.segment as CampaignSegment] ?? campaign.segment}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
      </div>

      <CampaignDetailView
        campaign={campaign}
        recipients={recipients ?? []}
        pendingLeads={pendingLeads}
        resendConfigured={isResendConfigured()}
      />
    </div>
  );
}
