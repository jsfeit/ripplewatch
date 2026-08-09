import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TrendsBoard } from "./trends-board";

export const metadata = { title: "Trends" };
export const dynamic = "force-dynamic";

export default async function TrendsPage() {
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

  const { data: trends } = await supabase
    .from("win_loss_trends")
    .select("*")
    .eq("account_id", profile.account_id)
    .order("won_count", { ascending: false });

  // Related-signal ids are stored on each trend row (see the generate
  // route) without title/url — those live on the real, current signal row,
  // fetched here so a since-scored/updated signal never shows stale text.
  const signalIds = Array.from(
    new Set((trends ?? []).flatMap((t) => t.related_signals.map((r) => r.signalId)))
  );
  const { data: relatedSignals } = signalIds.length
    ? await supabase.from("signals").select("id, title, url, type, occurred_on").in("id", signalIds)
    : { data: [] };

  const generatedAt = trends && trends.length > 0 ? trends[0].generated_at : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-10 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Trends</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Recurring themes across every logged win/loss reason, spanning all your tracked competitors — connected
          to real signals where the link is genuine.
        </p>
      </div>
      <TrendsBoard
        initialTrends={trends ?? []}
        initialGeneratedAt={generatedAt}
        signalsById={Object.fromEntries((relatedSignals ?? []).map((s) => [s.id, s]))}
      />
    </div>
  );
}
