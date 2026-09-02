import { AppSidebar } from "@/components/app/app-sidebar";
import { AskBubble } from "@/components/app/ask-bubble";
import { ImpersonationBanner } from "@/components/app/impersonation-banner";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountContext } from "@/lib/impersonation";

async function getDemoMode(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { accountId, db } = user
    ? await resolveAccountContext(supabase, user.id)
    : { accountId: null, db: supabase };
  if (!accountId) return false;
  const { data: account } = await db.from("accounts").select("demo_mode").eq("id", accountId).single();
  return account?.demo_mode ?? false;
}

export async function generateMetadata() {
  const demoMode = await getDemoMode();
  return demoMode ? { title: { template: "%s" } } : {};
}

export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { accountId, db, impersonation } = user
    ? await resolveAccountContext(supabase, user.id)
    : { accountId: null, db: supabase, impersonation: null };

  let tier = "starter";
  let demoMode = false;
  let competitorNames: string[] = [];
  if (accountId) {
    const [{ data: account }, { data: competitors }] = await Promise.all([
      db.from("accounts").select("tier, demo_mode").eq("id", accountId).single(),
      db.from("competitors").select("name").eq("account_id", accountId).order("created_at", { ascending: true }),
    ]);
    if (account) {
      tier = account.tier;
      demoMode = account.demo_mode;
    }
    competitorNames = (competitors ?? []).map((c) => c.name);
  }

  return (
    <div className="flex min-h-screen flex-col">
      {impersonation && !demoMode ? (
        <div className="print:hidden">
          <ImpersonationBanner accountName={impersonation.accountName} adminEmail={impersonation.adminEmail} />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="print:hidden">
          <AppSidebar tier={tier} demoMode={demoMode} />
        </div>
        <div className="flex-1 overflow-x-hidden">{children}</div>
        {user && !impersonation ? (
          <div className="print:hidden">
            <AskBubble competitorNames={competitorNames} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
