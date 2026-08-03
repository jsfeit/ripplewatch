import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardFeed } from "./dashboard-feed";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();

  if (!profile?.account_id) redirect("/onboarding");

  const { data: account } = await supabase
    .from("accounts")
    .select("name, positioning, icp, lost_deal_notes, churn_notes")
    .eq("id", profile.account_id)
    .single();

  const { data: competitors } = await supabase
    .from("competitors")
    .select("*")
    .eq("account_id", profile.account_id)
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
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-10 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signals across every tracked competitor. Scored alerts include the reasoning behind the verdict.
        </p>
      </div>

      <DashboardFeed
        competitors={competitors ?? []}
        signals={signals ?? []}
        previewContext={{
          companyName: account?.name ?? "",
          positioning: account?.positioning ?? "",
          icp: account?.icp ?? "",
          lossReason: account?.lost_deal_notes || account?.churn_notes || "",
        }}
      />
    </div>
  );
}
