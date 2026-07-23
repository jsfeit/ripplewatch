import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AskChat } from "./ask-chat";

export const metadata = { title: "Ask — Ripplewatch" };

export default async function AskPage() {
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

  const { data: competitors } = await supabase
    .from("competitors")
    .select("name")
    .eq("account_id", profile.account_id)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-3xl px-10 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Ask</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask anything about your tracked competitors — answered against your positioning, ICP, and the
          last 90 days of signals, not a generic search.
        </p>
      </div>

      <AskChat competitorNames={(competitors ?? []).map((c) => c.name)} />
    </div>
  );
}
