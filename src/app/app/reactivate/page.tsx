import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReactivateView } from "./reactivate-view";

export const metadata = { title: "Reactivate your account" };
export const dynamic = "force-dynamic";

export default async function ReactivatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("account_id").eq("id", user.id).single();
  if (!profile?.account_id) redirect("/onboarding");

  const { data: account } = await supabase
    .from("accounts")
    .select("name, subscription_status")
    .eq("id", profile.account_id)
    .single();
  if (!account) redirect("/onboarding");

  // Nothing to reactivate — send them back rather than showing a
  // confusing "resubscribe" page to an account that's actually fine.
  if (account.subscription_status !== "canceled") redirect("/app/dashboard");

  return <ReactivateView companyName={account.name} />;
}
