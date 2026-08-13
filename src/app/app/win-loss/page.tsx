import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountContext } from "@/lib/impersonation";
import { WinLossPageClient } from "./win-loss-page-client";

export const metadata = { title: "Win/Loss" };
export const dynamic = "force-dynamic";

export default async function WinLossPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { accountId, db } = await resolveAccountContext(supabase, user.id);
  if (!accountId) redirect("/onboarding");

  const { data: account } = await db.from("accounts").select("has_sales_crm, has_plg").eq("id", accountId).single();

  const { data: competitors } = await db
    .from("competitors")
    .select("id, name")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });
  const competitorIds = (competitors ?? []).map((c) => c.id);

  const { data: entries } = competitorIds.length
    ? await db
        .from("competitor_win_loss")
        .select("id, competitor_id, outcome, reason, created_at")
        .in("competitor_id", competitorIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const { data: hubspotIntegration } = await db
    .from("integrations")
    .select("connected")
    .eq("account_id", accountId)
    .eq("provider", "hubspot")
    .eq("connected", true)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-10 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Win/Loss</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Import, log, and see the recurring reasons behind every deal — across every competitor in one place,
          instead of buried inside each one&apos;s own page.
        </p>
      </div>

      <WinLossPageClient
        competitors={competitors ?? []}
        initialEntries={entries ?? []}
        hubspotConnected={Boolean(hubspotIntegration)}
        // Legacy accounts with neither flag set keep seeing win/loss, the
        // only option before churn logging existed — same default the
        // fact sheet already uses.
        showWinLoss={Boolean(account?.has_sales_crm) || !account?.has_plg}
        showChurn={Boolean(account?.has_plg)}
      />
    </div>
  );
}
