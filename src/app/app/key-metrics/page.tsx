import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TIER_SIGNAL_SOURCES } from "@/lib/tier-limits";
import { KeyMetricsBoard } from "./key-metrics-board";

export const metadata = { title: "Key metrics" };
export const dynamic = "force-dynamic";

export default async function KeyMetricsPage() {
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
    .select("tier")
    .eq("id", profile.account_id)
    .single();
  const tier = account?.tier ?? "starter";
  const seoAllowed = TIER_SIGNAL_SOURCES[tier].includes("seo");

  const { data: competitors } = await supabase
    .from("competitors")
    .select("*")
    .eq("account_id", profile.account_id)
    .order("created_at", { ascending: true });

  const competitorIds = (competitors ?? []).map((c) => c.id);

  const { data: seo } =
    seoAllowed && competitorIds.length
      ? await supabase.from("competitor_seo").select("*").in("competitor_id", competitorIds)
      : { data: [] };

  // Most recent seo-type signal per competitor, so cards can show "last
  // changed" the same way PricingCard does — a real diff, not just the
  // routine snapshot refresh.
  const { data: seoSignals } =
    seoAllowed && competitorIds.length
      ? await supabase
          .from("signals")
          .select("*")
          .in("competitor_id", competitorIds)
          .eq("type", "seo")
          .order("created_at", { ascending: false })
      : { data: [] };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-10 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Key metrics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estimated organic traffic and search trend per competitor.
        </p>
      </div>
      {seoAllowed ? (
        <KeyMetricsBoard competitors={competitors ?? []} seo={seo ?? []} seoSignals={seoSignals ?? []} />
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-secondary/20 px-8 py-12 text-center">
          <p className="text-sm font-medium">Key metrics is a Plus and Advanced feature</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Upgrade your plan to track estimated organic traffic and search trends per competitor.
          </p>
          <a
            href="/app/settings"
            className="mt-4 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            View plans
          </a>
        </div>
      )}
    </div>
  );
}
