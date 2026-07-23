import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PricingBoard } from "./pricing-board";

export const metadata = { title: "Pricing — Ripplewatch" };
export const dynamic = "force-dynamic";

export default async function PricingPage() {
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
    .select("*")
    .eq("account_id", profile.account_id)
    .order("created_at", { ascending: true });

  const competitorIds = (competitors ?? []).map((c) => c.id);

  const { data: pricing } = competitorIds.length
    ? await supabase.from("competitor_pricing").select("*").in("competitor_id", competitorIds)
    : { data: [] };

  // Most recent pricing-type signal per competitor, so cards can show "last
  // changed" and link back to the Alert feed entry that caught it.
  const { data: pricingSignals } = competitorIds.length
    ? await supabase
        .from("signals")
        .select("*")
        .in("competitor_id", competitorIds)
        .eq("type", "pricing")
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="mx-auto max-w-5xl px-10 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Pricing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each competitor&apos;s current tiers, features, and how they actually charge.
        </p>
      </div>
      <PricingBoard
        competitors={competitors ?? []}
        pricing={pricing ?? []}
        pricingSignals={pricingSignals ?? []}
      />
    </div>
  );
}
