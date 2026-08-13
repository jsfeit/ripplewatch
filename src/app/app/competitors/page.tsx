import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountContext } from "@/lib/impersonation";
import { CompetitorManager } from "@/components/app/competitor-manager";
import { SuggestedCompetitorsPanel } from "@/components/app/suggested-competitors-panel";

export const dynamic = "force-dynamic";

export default async function CompetitorsIndexPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { accountId, db } = await resolveAccountContext(supabase, user.id);
  if (!accountId) redirect("/onboarding");

  const { data: account } = await db.from("accounts").select("tier").eq("id", accountId).single();
  if (!account) redirect("/onboarding");

  const { data: competitors } = await db
    .from("competitors")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });

  if (competitors && competitors.length > 0) {
    redirect(`/app/competitors/${competitors[0].id}`);
  }

  const { data: suggestions } = await db
    .from("suggested_competitors")
    .select("*")
    .eq("account_id", accountId)
    .eq("status", "pending")
    .order("discovered_at", { ascending: false });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-10 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Competitors &amp; Comparison</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add your first competitor to start tracking signals, then compare yourself to one at a time.
        </p>
      </div>
      <SuggestedCompetitorsPanel suggestions={suggestions ?? []} />
      <CompetitorManager competitors={[]} tier={account.tier} />
    </div>
  );
}
