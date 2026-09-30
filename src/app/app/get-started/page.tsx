import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GetStartedFlow } from "./get-started-flow";

export const metadata = { title: "Get started" };

// Where a Connect signup lands right after checkout (see the return_url in
// createConnectSignupSession) — before /app/settings, not after. Checkout
// itself only asks for a company name and a card, on purpose, to keep
// signup fast; without this step the account has no positioning, ICP, or
// competitors, so a brand-new customer's first question to their assistant
// has nothing real to answer with. Already-onboarded accounts (positioning
// set, or at least one competitor) skip straight past this to Settings.
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
    .select("id, name, tier, positioning")
    .eq("id", profile.account_id)
    .single();
  if (!account || account.tier !== "connect") redirect("/app/settings");

  const { count: competitorCount } = await supabase
    .from("competitors")
    .select("id", { count: "exact", head: true })
    .eq("account_id", account.id);

  if (account.positioning || (competitorCount ?? 0) > 0) redirect("/app/settings?tab=connect");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-10">
      <GetStartedFlow companyName={account.name} />
    </div>
  );
}
