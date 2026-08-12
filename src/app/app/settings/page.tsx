import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsView } from "./settings-view";

export const metadata = { title: "Settings" };
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

  // Never selects key_hash — the plaintext key is shown once at creation
  // and this list only ever needs the prefix/metadata to render.
  const { data: apiKeys } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, last_used_at, revoked_at, created_at")
    .eq("account_id", profile.account_id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-10 sm:py-10">
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
        apiKeys={apiKeys ?? []}
        currentUserId={user.id}
      />
    </div>
  );
}
