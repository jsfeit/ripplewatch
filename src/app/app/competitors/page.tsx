import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompetitorManager } from "@/components/app/competitor-manager";
import { SuggestedCompetitorsPanel } from "@/components/app/suggested-competitors-panel";

export const dynamic = "force-dynamic";

export default async function CompetitorsIndexPage() {
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
    .select("tier")
    .eq("id", profile.account_id)
    .single();
  if (!account) redirect("/onboarding");

  const { data: competitors } = await supabase
    .from("competitors")
    .select("*")
    .eq("account_id", profile.account_id)
    .order("created_at", { ascending: true });

  if (competitors && competitors.length > 0) {
    redirect(`/app/competitors/${competitors[0].id}`);
  }

  const { data: suggestions } = await supabase
    .from("suggested_competitors")
    .select("*")
    .eq("account_id", profile.account_id)
    .eq("status", "pending")
    .order("discovered_at", { ascending: false });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-10 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Competitors</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add your first competitor to start tracking signals.
        </p>
      </div>
      <SuggestedCompetitorsPanel suggestions={suggestions ?? []} />
      <CompetitorManager competitors={[]} tier={account.tier} />
    </div>
  );
}
