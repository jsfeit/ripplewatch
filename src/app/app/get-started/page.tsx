import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GetStartedFlow } from "./get-started-flow";

export const metadata = { title: "Get started" };

// Where a Connect signup lands right after checkout (see the return_url in
// createConnectSignupSession) — before /app/settings, not after. Checkout
// itself only asks for a company name and a card, on purpose, to keep
// signup fast. The first thing shown here is connecting an assistant (the
// one step that makes the purchase do anything); positioning, ICP, and
// competitors follow as optional, skippable context. An account only stops
// landing here once it's explicitly finished or skipped that — see
// connect_get_started_dismissed_at, set by /api/connect/onboarding/complete
// or /api/connect/onboarding/skip — not based on whether any field happens
// to be filled in, since connecting the assistant alone is a complete,
// valid stopping point.
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
