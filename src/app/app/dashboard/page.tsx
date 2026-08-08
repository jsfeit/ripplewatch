import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardFeed } from "./dashboard-feed";

export const metadata = { title: "News" };
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
    .select("name, positioning, icp, lost_deal_notes, churn_notes, tier")
    .eq("id", profile.account_id)
    .single();

  const { data: competitors } = await supabase
    .from("competitors")
    .select("*")
    .eq("account_id", profile.account_id)
    .order("created_at", { ascending: true });

  const competitorIds = (competitors ?? []).map((c) => c.id);
  // SEO/traffic signals have their own dashboard (Key metrics) rather than
  // surfacing in the News feed — excluded at the query level, not just from
  // the type filter chips, so they never render here at all.
  const { data: signals } = competitorIds.length
    ? await supabase
        .from("signals")
        .select("*")
        .in("competitor_id", competitorIds)
        .neq("type", "seo")
        .order("occurred_on", { ascending: false })
    : { data: [] };

  const signalIds = (signals ?? []).map((s) => s.id);
  const { data: evalLabels } = signalIds.length
    ? await supabase.from("signal_eval_labels").select("signal_id, label").in("signal_id", signalIds)
    : { data: [] };
  const evalLabelBySignalId = Object.fromEntries((evalLabels ?? []).map((l) => [l.signal_id, l.label]));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-10 sm:py-8">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">News</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signals across every tracked competitor. Scored alerts include the reasoning behind the verdict.
        </p>
      </div>

      <DashboardFeed
        competitors={competitors ?? []}
        signals={signals ?? []}
        evalLabelBySignalId={evalLabelBySignalId}
        tier={account?.tier ?? "starter"}
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
