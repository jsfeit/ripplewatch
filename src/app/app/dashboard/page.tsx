import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DashboardFeed } from "./dashboard-feed";

// Banner goes stale rather than lying: if the weekly cron ever fails to
// run, an 8-day-old "this week's takeaway" reading as current would be
// actively misleading, so it just disappears instead once it's too old to
// trust — regenerating next successful cron run brings it back.
const VERDICT_STALE_MS = 8 * 24 * 60 * 60 * 1000;

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
    .select("name, positioning, icp, lost_deal_notes, churn_notes, tier, weekly_verdict, weekly_verdict_generated_at")
    .eq("id", profile.account_id)
    .single();

  const now = new Date();
  const verdictIsFresh =
    account?.weekly_verdict &&
    account.weekly_verdict_generated_at &&
    now.getTime() - new Date(account.weekly_verdict_generated_at).getTime() < VERDICT_STALE_MS;

  const { data: competitors } = await supabase
    .from("competitors")
    .select("*")
    .eq("account_id", profile.account_id)
    .order("created_at", { ascending: true });

  const competitorIds = (competitors ?? []).map((c) => c.id);
  // SEO/traffic signals have their own dashboard (Trends) rather than
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

      {verdictIsFresh ? (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-primary/25 bg-primary/[0.04] p-3.5">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">This week&apos;s takeaway</p>
            <p className="mt-1 text-sm text-foreground">{account!.weekly_verdict}</p>
          </div>
        </div>
      ) : null}

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
