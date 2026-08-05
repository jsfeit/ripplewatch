import { AppSidebar } from "@/components/app/app-sidebar";
import { AskBubble } from "@/components/app/ask-bubble";
import { createClient } from "@/lib/supabase/server";

export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let tier = "starter";
  let competitorNames: string[] = [];
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("id", user.id)
      .single();
    if (profile?.account_id) {
      const [{ data: account }, { data: competitors }] = await Promise.all([
        supabase.from("accounts").select("tier").eq("id", profile.account_id).single(),
        supabase
          .from("competitors")
          .select("name")
          .eq("account_id", profile.account_id)
          .order("created_at", { ascending: true }),
      ]);
      if (account) tier = account.tier;
      competitorNames = (competitors ?? []).map((c) => c.name);
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AppSidebar tier={tier} />
      <div className="flex-1 overflow-x-hidden">{children}</div>
      {user ? <AskBubble competitorNames={competitorNames} /> : null}
    </div>
  );
}
