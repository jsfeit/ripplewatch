import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GetStartedFlow } from "./get-started-flow";

export const metadata = { title: "Get started" };

// Where a Connect signup lands right after checkout (see the return_url in
// createConnectSignupSession) — before /app/settings, not after. Checkout
// itself only asks for a company name and a card, on purpose, to keep
// signup fast. Four required-feeling steps follow: connecting an
// assistant and adding a competitor are both mandatory (see
// get-started-flow.tsx — the assistant step blocks Continue until it's
// actually connected, and the server rejects a competitor-less submit in
// /api/connect/onboarding/complete), since neither the product nor the
// rest of this wizard means anything without them. Business context and
// Slack stay optional. An account only stops landing here once
// connect_get_started_dismissed_at is set, by that same complete route.
export default async function GetStartedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("account_id").eq("id", user.id).single();
  if (!profile?.account_id) redirect("/onboarding");

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, tier, connect_get_started_dismissed_at, mcp_last_connected_at")
    .eq("id", profile.account_id)
    .single();
  if (!account || account.tier !== "connect") redirect("/app/settings");

  if (account.connect_get_started_dismissed_at) redirect("/app/settings?tab=connect");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-10">
      <GetStartedFlow companyName={account.name} mcpLastConnectedAt={account.mcp_last_connected_at} />
    </div>
  );
}
