import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { SupabaseNotConfigured } from "@/components/admin/not-configured";
import { isResendConfigured } from "@/lib/resend";
import { CampaignsView } from "@/components/admin/campaigns-view";

export const metadata = { title: "Campaigns | Admin" };
export const dynamic = "force-dynamic";

export default async function AdminCampaignsPage() {
  const configured = isSupabaseConfigured();
  const { data: campaigns } = configured
    ? await createAdminClient().from("email_campaigns").select("*").order("created_at", { ascending: false })
    : { data: null };

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One-off marketing sends, distinct from the product&apos;s transactional emails (digests, invites).
        </p>
      </div>

      {!configured ? (
        <SupabaseNotConfigured />
      ) : (
        <CampaignsView initialCampaigns={campaigns ?? []} resendConfigured={isResendConfigured()} />
      )}
    </div>
  );
}
