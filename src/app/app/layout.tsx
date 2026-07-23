import { AppSidebar } from "@/components/app/app-sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let tier = "starter";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("id", user.id)
      .single();
    if (profile?.account_id) {
      const { data: account } = await supabase
        .from("accounts")
        .select("tier")
        .eq("id", profile.account_id)
        .single();
      if (account) tier = account.tier;
    }
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar tier={tier} />
      <div className="flex-1 overflow-x-hidden">{children}</div>
    </div>
  );
}
