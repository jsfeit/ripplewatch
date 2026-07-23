import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { SupabaseNotConfigured } from "@/components/admin/not-configured";
import { AccountAdminView } from "@/components/admin/account-admin-view";

export const dynamic = "force-dynamic";

export default async function AdminAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-10">
        <SupabaseNotConfigured />
      </div>
    );
  }

  const supabase = createAdminClient();

  const { data: account } = await supabase.from("accounts").select("*").eq("id", id).single();
  if (!account) notFound();

  const { data: competitors } = await supabase
    .from("competitors")
    .select("*")
    .eq("account_id", id)
    .order("created_at", { ascending: true });

  const competitorIds = (competitors ?? []).map((c) => c.id);
  const { data: signals } = competitorIds.length
    ? await supabase
        .from("signals")
        .select("*")
        .in("competitor_id", competitorIds)
        .order("occurred_on", { ascending: false })
    : { data: [] };

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <AccountAdminView account={account} competitors={competitors ?? []} signals={signals ?? []} />
    </div>
  );
}
