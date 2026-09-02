import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountContext } from "@/lib/impersonation";
import { AskChat } from "./ask-chat";

export const metadata = { title: "Ask" };

export default async function AskPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { accountId, db } = await resolveAccountContext(supabase, user.id);
  if (!accountId) redirect("/onboarding");

  const { data: competitors } = await db
    .from("competitors")
    .select("name")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-10 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Ask</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask anything about your tracked competitors, answered against your positioning, ICP, and the
          last 90 days of signals, not a generic search.
        </p>
      </div>

      <AskChat competitorNames={(competitors ?? []).map((c) => c.name)} />
    </div>
  );
}
