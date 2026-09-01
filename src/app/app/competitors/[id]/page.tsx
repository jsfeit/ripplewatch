import { notFound, redirect } from "next/navigation";
import { Globe } from "lucide-react";
import { cn, avatarColor } from "@/lib/utils";
import { CompetitorManager } from "@/components/app/competitor-manager";
import { SuggestedCompetitorsPanel } from "@/components/app/suggested-competitors-panel";
import { CompetitorMonitoringUrls } from "@/components/app/competitor-monitoring-urls";
import { CompetitorFactSheet } from "@/components/app/competitor-fact-sheet";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountContext } from "@/lib/impersonation";
import { computeMomentum, type MomentumResult } from "@/lib/momentum";
import { TIER_SIGNAL_SOURCES } from "@/lib/tier-limits";

export const dynamic = "force-dynamic";

export default async function CompetitorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { accountId, db } = await resolveAccountContext(supabase, user.id);
  if (!accountId) redirect("/onboarding");

  const { data: account } = await db
    .from("accounts")
    .select("name, tier, has_sales_crm, has_plg")
    .eq("id", accountId)
    .single();
  if (!account) redirect("/onboarding");

  const { data: competitors } = await db
    .from("competitors")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });

  const competitor = (competitors ?? []).find((c) => c.id === id);
  if (!competitor) notFound();

  const { data: suggestions } = await db
    .from("suggested_competitors")
    .select("*")
    .eq("account_id", accountId)
    .eq("status", "pending")
    .order("discovered_at", { ascending: false });

  const { data: winLoss } = await db
    .from("competitor_win_loss")
    .select("id, outcome, reason, created_at")
    .eq("competitor_id", id)
    .order("created_at", { ascending: false });

  const { data: hubspotIntegration } = await db
    .from("integrations")
    .select("connected")
    .eq("account_id", accountId)
    .eq("provider", "hubspot")
    .eq("connected", true)
    .maybeSingle();

  // Same computeMomentum used on Trends, surfaced here too so it's
  // visible on the page people actually click into a competitor from.
  const competitorIds = (competitors ?? []).map((c) => c.id);
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 60);
  const { data: momentumSignals } = competitorIds.length
    ? await db
        .from("signals")
        .select("competitor_id, type, sentiment, occurred_on, scored, relevance_score")
        .in("competitor_id", competitorIds)
        .gte("occurred_on", sixtyDaysAgo.toISOString().slice(0, 10))
    : { data: [] };
  const { data: momentumWinLoss } = competitorIds.length
    ? await db.from("competitor_win_loss").select("competitor_id, outcome, created_at").in("competitor_id", competitorIds)
    : { data: [] };
  const momentumByCompetitorId: Record<string, MomentumResult> = {};
  for (const c of competitors ?? []) {
    momentumByCompetitorId[c.id] = computeMomentum(
      (momentumSignals ?? []).filter((s) => s.competitor_id === c.id),
      (momentumWinLoss ?? []).filter((e) => e.competitor_id === c.id)
    );
  }

  // Traffic estimate for the sort control — same tier gate as Trends,
  // just the number, not the full competitor_seo record.
  const seoAllowed = TIER_SIGNAL_SOURCES[account.tier].includes("seo");
  const { data: seo } =
    seoAllowed && competitorIds.length
      ? await db.from("competitor_seo").select("competitor_id, organic_traffic_estimate").in("competitor_id", competitorIds)
      : { data: [] };
  const trafficByCompetitorId = Object.fromEntries(
    (seo ?? []).map((s) => [s.competitor_id, s.organic_traffic_estimate])
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-10 sm:py-10">
      <div className="mb-6 print:hidden">
        <h1 className="text-2xl font-semibold tracking-tight">Competitors &amp; Comparison</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track who you&apos;re up against, then compare yourself to one of them at a time below.
        </p>
      </div>

      <div className="print:hidden">
        <CompetitorManager
          competitors={competitors ?? []}
          tier={account.tier}
          activeId={id}
          momentum={momentumByCompetitorId}
          traffic={trafficByCompetitorId}
          seoAllowed={seoAllowed}
        />
      </div>

      <div className="mt-6 flex items-center gap-3 print:hidden">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-full text-sm font-semibold",
            avatarColor(competitor.name)
          )}
        >
          {competitor.name.charAt(0).toUpperCase()}
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{competitor.name}</h1>
          {competitor.domain ? (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Globe className="size-3.5" />
              {competitor.domain}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-border p-4 print:hidden">
        <h2 className="text-sm font-semibold text-muted-foreground">Monitoring sources</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Where we check for pricing and hiring changes. Pre-filled with a best guess from the domain: correct
          them if we guessed wrong, or a competitor uses a different path.
        </p>
        <div className="mt-3">
          <CompetitorMonitoringUrls
            competitorId={competitor.id}
            domain={competitor.domain}
            initialPricingUrl={competitor.pricing_url}
            initialCareersUrl={competitor.careers_url}
          />
        </div>
      </div>

      {/* Scroll target for the "View fact sheet" deep link on the Competitors
          list, and the only section left visible when printing this page. */}
      <div id="fact-sheet">
        <CompetitorFactSheet
          competitorId={competitor.id}
          competitorName={competitor.name}
          accountName={account.name}
          hubspotConnected={Boolean(hubspotIntegration)}
          // Legacy accounts that predate this question on both false: keep
          // showing win/loss (the original, only option) rather than
          // hiding data-collection entirely.
          showWinLoss={account.has_sales_crm || !account.has_plg}
          showChurn={account.has_plg}
          initialWhyWeWin={competitor.fact_sheet_why_we_win}
          initialWhyWeLose={competitor.fact_sheet_why_we_lose}
          initialGeneratedAt={competitor.fact_sheet_generated_at}
          initialWinLoss={winLoss ?? []}
        />
      </div>

      <div className="mt-8 print:hidden">
        <SuggestedCompetitorsPanel suggestions={suggestions ?? []} />
      </div>
    </div>
  );
}
