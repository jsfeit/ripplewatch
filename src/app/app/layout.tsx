import { AppSidebar } from "@/components/app/app-sidebar";
import { AskBubble } from "@/components/app/ask-bubble";
import { ImpersonationBanner } from "@/components/app/impersonation-banner";
import { ActivityBeacon } from "@/components/app/activity-beacon";
import { DemoBanner } from "@/components/app/demo-banner";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountContext } from "@/lib/impersonation";
import { setupProgress } from "@/lib/connect-setup";

export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { accountId, db, impersonation } = user
    ? await resolveAccountContext(supabase, user.id)
    : { accountId: null, db: supabase, impersonation: null };

  let tier = "plus";
  let demoMode = false;
  let competitorNames: string[] = [];
  // Only Connect accounts get a "Finish setup" shortcut in the sidebar; null
  // once everything is done, so it disappears instead of nagging.
  let setup: { done: number; total: number; wizardOpen: boolean } | null = null;
  if (accountId) {
    const [{ data: account }, { data: competitors }] = await Promise.all([
      db
        .from("accounts")
        .select("tier, demo_mode, mcp_last_connected_at, positioning, icp, connect_get_started_dismissed_at")
        .eq("id", accountId)
        .single(),
      db.from("competitors").select("name").eq("account_id", accountId).order("created_at", { ascending: true }),
    ]);
    if (account) {
      tier = account.tier;
      demoMode = account.demo_mode;
    }
    competitorNames = (competitors ?? []).map((c) => c.name);

    if (account?.tier === "connect") {
      const [{ data: slack }, { count: dealCount }] = await Promise.all([
        db
          .from("integrations")
          .select("connected")
          .eq("account_id", accountId)
          .eq("provider", "slack")
          .eq("connected", true)
          .limit(1),
        db.from("competitor_win_loss").select("id", { count: "exact", head: true }).eq("account_id", accountId),
      ]);
      const progress = setupProgress({
        connected: Boolean(account.mcp_last_connected_at),
        hasPositioning: Boolean(account.positioning?.trim() || account.icp?.trim()),
        competitorCount: competitorNames.length,
        slackConnected: (slack ?? []).length > 0,
        hasDealHistory: (dealCount ?? 0) > 0,
      });
      if (progress.done < progress.total) {
        setup = { ...progress, wizardOpen: !account.connect_get_started_dismissed_at };
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      {demoMode ? (
        <div className="print:hidden">
          <DemoBanner />
        </div>
      ) : null}
      {impersonation ? (
        <div className="print:hidden">
          <ImpersonationBanner accountName={impersonation.accountName} adminEmail={impersonation.adminEmail} />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="print:hidden">
          <AppSidebar tier={tier} setup={setup} />
        </div>
        <div className="flex-1 overflow-x-hidden">{children}</div>
        {user && !impersonation ? <ActivityBeacon /> : null}
        {user && !impersonation && tier !== "connect" ? (
          <div className="print:hidden">
            <AskBubble competitorNames={competitorNames} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
