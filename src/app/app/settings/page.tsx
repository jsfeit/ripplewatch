import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsView } from "./settings-view";

export const metadata = { title: "Settings — Ripplewatch" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
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
    .select("*")
    .eq("id", profile.account_id)
    .single();
  if (!account) redirect("/onboarding");

  const { data: competitors } = await supabase
    .from("competitors")
    .select("*")
    .eq("account_id", profile.account_id)
    .order("created_at", { ascending: true });

  const { data: integrations } = await supabase
    .from("integrations")
    .select("*")
    .eq("account_id", profile.account_id);

  const competitorIds = (competitors ?? []).map((c) => c.id);
  const { data: recentSignals } = competitorIds.length
    ? await supabase
        .from("signals")
        .select("*")
        .in("competitor_id", competitorIds)
        .order("occurred_on", { ascending: false })
        .limit(10)
    : { data: [] };

  return (
    <div className="mx-auto max-w-5xl px-10 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage integrations, your team, and your plan.
        </p>
      </div>
      <SettingsView
        account={account}
        competitors={competitors ?? []}
        integrations={integrations ?? []}
        recentSignals={recentSignals ?? []}
        currentUserId={user.id}
      />
    </div>
  );
}
