import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountContext } from "@/lib/impersonation";
import { TIER_SIGNAL_SOURCES } from "@/lib/tier-limits";
import { MomentumBoard } from "./momentum-board";
import { TrendsBoard } from "./trends-board";
import { IndustryPulse } from "./industry-pulse";
import { bucketMonthlyActivity } from "@/lib/monthly-activity";

export const metadata = { title: "Trends" };
export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { accountId, db } = await resolveAccountContext(supabase, user.id);
  if (!accountId) redirect("/onboarding");

  const { data: account } = await db.from("accounts").select("name, tier").eq("id", accountId).single();
  const tier = account?.tier ?? "starter";
  const seoAllowed = TIER_SIGNAL_SOURCES[tier].includes("seo");

  const { data: competitors } = await db
    .from("competitors")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });
  const competitorIds = (competitors ?? []).map((c) => c.id);

  const { data: seo } =
    seoAllowed && competitorIds.length
      ? await db.from("competitor_seo").select("*").in("competitor_id", competitorIds)
      : { data: [] };

  // Most recent seo-type signal per competitor, so cards can show "last
  // changed" the same way PricingCard does — a real diff, not just the
  // routine snapshot refresh.
  const { data: seoSignals } =
    seoAllowed && competitorIds.length
      ? await db
          .from("signals")
          .select("*")
          .in("competitor_id", competitorIds)
          .eq("type", "seo")
          .order("created_at", { ascending: false })
      : { data: [] };

  // Momentum is available to every tier — it's built entirely from data
  // every account already has (hiring, pricing, press/funding, relevance
  // scoring), unlike the SEO/traffic card below which stays Plus/Advanced.
  // 60 days back covers both the "recent" and "prior" comparison windows
  // computeMomentum needs; occurred_on (not created_at) so this reflects
  // when things actually happened, same convention as signal-freshness.ts.
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 60);
  const { data: momentumSignals } = competitorIds.length
    ? await db
        .from("signals")
        .select("competitor_id, type, occurred_on, scored, relevance_score")
        .in("competitor_id", competitorIds)
        .gte("occurred_on", sixtyDaysAgo.toISOString().slice(0, 10))
    : { data: [] };

  // 6-month window of job-posting and pricing signals across every tracked
  // competitor, aggregated (not per-competitor) — the point is a category-
  // level activity read that still works when any one competitor is too
  // small to generate much individual signal volume. Uses real signal data
  // only (job_posting/pricing come from actual scraping), unlike SEO/traffic
  // which is still a placeholder data source (see seo-data.ts) and stays
  // out of this chart for the same reason momentum.ts excludes it.
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 6);
  const { data: activitySignals } = competitorIds.length
    ? await db
        .from("signals")
        .select("type, occurred_on")
        .in("competitor_id", competitorIds)
        .in("type", ["job_posting", "pricing"])
        .gte("occurred_on", sixMonthsAgo.toISOString().slice(0, 10))
    : { data: [] };
  const monthlyActivity = bucketMonthlyActivity(activitySignals ?? []);

  const { data: industryTrends } = await db
    .from("industry_trends")
    .select("trends, generated_at")
    .eq("account_id", accountId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: winLossTrends } = await db
    .from("win_loss_trends")
    .select("*")
    .eq("account_id", accountId)
    .order("won_count", { ascending: false });

  // Related-signal ids are stored on each trend row (see the generate
  // route) without title/url — those live on the real, current signal row,
  // fetched here so a since-scored/updated signal never shows stale text.
  const signalIds = Array.from(
    new Set((winLossTrends ?? []).flatMap((t) => t.related_signals.map((r) => r.signalId)))
  );
  const { data: relatedSignals } = signalIds.length
    ? await db.from("signals").select("id, title, url, type, occurred_on").in("id", signalIds)
    : { data: [] };

  const trendsGeneratedAt = winLossTrends && winLossTrends.length > 0 ? winLossTrends[0].generated_at : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-10 sm:py-10">
      <div className="mb-8 print:hidden">
        <h1 className="text-2xl font-semibold tracking-tight">Trends</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Momentum per competitor, plus recurring themes across every logged win/loss reason.
        </p>
      </div>

      <div className="print:hidden">
        <h2 className="text-sm font-semibold">Momentum</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Hiring, pricing activity, press/funding, and relevance trend, plus estimated organic traffic where
          available.
        </p>
        <div className="mt-4">
          <MomentumBoard
            competitors={competitors ?? []}
            momentumSignals={momentumSignals ?? []}
            seoAllowed={seoAllowed}
            seo={seo ?? []}
            seoSignals={seoSignals ?? []}
          />
        </div>
      </div>

      <div className="mt-10 print:mt-0">
        <h2 className="text-sm font-semibold print:hidden">Industry pulse</h2>
        <p className="mt-1 text-xs text-muted-foreground print:hidden">
          Category-level activity and market trends, for when your tracked competitors are too small to
          generate much individual news on their own.
        </p>
        <div className="mt-4 print:mt-0">
          <IndustryPulse
            monthlyActivity={monthlyActivity}
            trends={industryTrends?.trends ?? []}
            trendsGeneratedAt={industryTrends?.generated_at ?? null}
          />
        </div>
      </div>

      <div className="mt-10 print:mt-0">
        <h2 className="text-sm font-semibold print:hidden">Win/loss trends</h2>
        <p className="mt-1 text-xs text-muted-foreground print:hidden">
          The recurring reasons you&apos;re winning and losing deals, grouped into patterns across all your
          competitors, with links to the news that explains them when we find a real connection.
        </p>
        <div className="mt-4 print:mt-0">
          <TrendsBoard
            accountName={account?.name ?? ""}
            initialTrends={winLossTrends ?? []}
            initialGeneratedAt={trendsGeneratedAt}
            signalsById={Object.fromEntries((relatedSignals ?? []).map((s) => [s.id, s]))}
          />
        </div>
      </div>
    </div>
  );
}
