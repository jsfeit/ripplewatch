import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountContext } from "@/lib/impersonation";
import { TIER_SIGNAL_SOURCES } from "@/lib/tier-limits";
import { bucketMonthlyActivity } from "@/lib/monthly-activity";
import { DashboardFeed } from "./dashboard-feed";
import { CompetitorOverview } from "./competitor-overview";
import { IndustryPulse } from "../trends/industry-pulse";
import { TrendsBoard } from "../trends/trends-board";
import { PricingBoard } from "../pricing/pricing-board";
import { WinLossPageClient } from "../win-loss/win-loss-page-client";
import type { Database } from "@/lib/supabase/types";

type Signal = Database["public"]["Tables"]["signals"]["Row"];

// Banner goes stale rather than lying: if the weekly cron ever fails to
// run, an 8-day-old "this week's takeaway" reading as current would be
// actively misleading, so it just disappears instead once it's too old to
// trust — regenerating next successful cron run brings it back.
const VERDICT_STALE_MS = 8 * 24 * 60 * 60 * 1000;

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "trends", label: "Trends" },
  { id: "win-loss", label: "Win/loss" },
  { id: "news", label: "News" },
  { id: "pricing", label: "Competitor pricing" },
];

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

// Single home page: news, competitor pricing, trends (momentum + industry
// pulse + recurring win/loss themes), and the win/loss log, stacked in one
// scroll instead of four separate nav items that never referenced each
// other. Formerly /app/trends, /app/pricing, and /app/win-loss — those
// routes now redirect here (see each folder's page.tsx).
export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { accountId, db } = await resolveAccountContext(supabase, user.id);
  if (!accountId) redirect("/onboarding");

  const { data: account } = await db
    .from("accounts")
    .select(
      "name, positioning, icp, lost_deal_notes, churn_notes, tier, has_sales_crm, has_plg, weekly_verdict, weekly_verdict_generated_at, trends_digest, trends_digest_generated_at"
    )
    .eq("id", accountId)
    .single();
  const tier = account?.tier ?? "starter";
  const seoAllowed = TIER_SIGNAL_SOURCES[tier].includes("seo");

  const now = new Date();
  const verdictIsFresh =
    account?.weekly_verdict &&
    account.weekly_verdict_generated_at &&
    now.getTime() - new Date(account.weekly_verdict_generated_at).getTime() < VERDICT_STALE_MS;
  // Same staleness rule as the weekly verdict above, applied to the
  // separate momentum takeaway (see generateMomentumDigest) — stale rather
  // than lying if the weekly cron ever misses a run.
  const trendsDigestIsFresh =
    account?.trends_digest &&
    account.trends_digest_generated_at &&
    now.getTime() - new Date(account.trends_digest_generated_at).getTime() < VERDICT_STALE_MS;

  const { data: competitors } = await db
    .from("competitors")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });
  const competitorIds = (competitors ?? []).map((c) => c.id);

  // --- News ---
  // SEO/traffic signals surface in Trends below, not here.
  const { data: signals } = competitorIds.length
    ? await db
        .from("signals")
        .select("*")
        .in("competitor_id", competitorIds)
        .neq("type", "seo")
        .order("occurred_on", { ascending: false })
    : { data: [] };
  const signalIds = (signals ?? []).map((s) => s.id);
  const { data: evalLabels } = signalIds.length
    ? await db.from("signal_eval_labels").select("signal_id, label").in("signal_id", signalIds)
    : { data: [] };
  const evalLabelBySignalId = Object.fromEntries((evalLabels ?? []).map((l) => [l.signal_id, l.label]));

  // Most recent signal per competitor, for the overview strip — `signals`
  // is already ordered occurred_on desc, so the first match per
  // competitor_id is the latest.
  const latestSignalByCompetitor: Record<string, Signal> = {};
  for (const signal of signals ?? []) {
    if (!(signal.competitor_id in latestSignalByCompetitor)) latestSignalByCompetitor[signal.competitor_id] = signal;
  }

  // --- Competitor pricing ---
  const { data: pricing } = competitorIds.length
    ? await db.from("competitor_pricing").select("*").in("competitor_id", competitorIds)
    : { data: [] };
  const pricingByCompetitor = Object.fromEntries((pricing ?? []).map((p) => [p.competitor_id, p]));
  const { data: pricingSignals } = competitorIds.length
    ? await db
        .from("signals")
        .select("*")
        .in("competitor_id", competitorIds)
        .eq("type", "pricing")
        .order("created_at", { ascending: false })
    : { data: [] };

  // --- Trends: momentum + industry pulse ---
  const { data: seo } =
    seoAllowed && competitorIds.length
      ? await db.from("competitor_seo").select("*").in("competitor_id", competitorIds)
      : { data: [] };
  const { data: seoSignals } =
    seoAllowed && competitorIds.length
      ? await db
          .from("signals")
          .select("*")
          .in("competitor_id", competitorIds)
          .eq("type", "seo")
          .order("created_at", { ascending: false })
      : { data: [] };
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 60);
  const { data: momentumSignals } = competitorIds.length
    ? await db
        .from("signals")
        .select("competitor_id, type, occurred_on, scored, relevance_score")
        .in("competitor_id", competitorIds)
        .gte("occurred_on", sixtyDaysAgo.toISOString().slice(0, 10))
    : { data: [] };

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

  // --- Trends: recurring win/loss themes ---
  const { data: winLossTrends } = await db
    .from("win_loss_trends")
    .select("*")
    .eq("account_id", accountId)
    .order("won_count", { ascending: false });
  const trendSignalIds = Array.from(
    new Set((winLossTrends ?? []).flatMap((t) => t.related_signals.map((r) => r.signalId)))
  );
  const { data: relatedSignals } = trendSignalIds.length
    ? await db.from("signals").select("id, title, url, type, occurred_on").in("id", trendSignalIds)
    : { data: [] };
  const trendsGeneratedAt = winLossTrends && winLossTrends.length > 0 ? winLossTrends[0].generated_at : null;

  // --- Win/loss log ---
  const { data: winLossEntries } = competitorIds.length
    ? await db
        .from("competitor_win_loss")
        .select("id, competitor_id, outcome, reason, created_at")
        .in("competitor_id", competitorIds)
        .order("created_at", { ascending: false })
    : { data: [] };
  const { data: hubspotIntegration } = await db
    .from("integrations")
    .select("connected")
    .eq("account_id", accountId)
    .eq("provider", "hubspot")
    .eq("connected", true)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-10 sm:py-10">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything scored and tracked for your account, in one place.
        </p>
      </div>

      <nav className="mb-6 flex flex-wrap gap-2 print:hidden">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground"
          >
            {s.label}
          </a>
        ))}
      </nav>

      {verdictIsFresh ? (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-primary/25 bg-primary/[0.04] p-3.5">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">This week&apos;s takeaway</p>
            <p className="mt-1 text-sm text-foreground">{account!.weekly_verdict}</p>
          </div>
        </div>
      ) : null}

      <section id="overview" className="scroll-mt-20">
        <h2 className="text-sm font-semibold">Overview</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Every tracked competitor at a glance: momentum, latest signal, and price point. Expand a row for the
          detail behind its momentum score.
        </p>
        <div className="mt-4">
          <CompetitorOverview
            competitors={competitors ?? []}
            momentumSignals={momentumSignals ?? []}
            seoAllowed={seoAllowed}
            seo={seo ?? []}
            seoSignals={seoSignals ?? []}
            latestSignalByCompetitor={latestSignalByCompetitor}
            pricingByCompetitor={pricingByCompetitor}
          />
        </div>
      </section>

      <section id="trends" className="mt-10 scroll-mt-20">
        <h2 className="text-sm font-semibold">Trends</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Category-level activity and recurring themes across every logged win/loss reason. Per-competitor
          momentum is above, in Overview.
        </p>
        {trendsDigestIsFresh ? (
          <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-primary/25 bg-primary/[0.04] p-3.5">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-sm text-foreground">{account!.trends_digest}</p>
          </div>
        ) : null}
        <div className="mt-4">
          <IndustryPulse
            monthlyActivity={monthlyActivity}
            trends={industryTrends?.trends ?? []}
            trendsGeneratedAt={industryTrends?.generated_at ?? null}
          />
        </div>
        <div className="mt-6">
          <TrendsBoard
            accountName={account?.name ?? ""}
            initialTrends={winLossTrends ?? []}
            initialGeneratedAt={trendsGeneratedAt}
            signalsById={Object.fromEntries((relatedSignals ?? []).map((s) => [s.id, s]))}
          />
        </div>
      </section>

      <section id="win-loss" className="mt-10 scroll-mt-20">
        <h2 className="text-sm font-semibold">Win/loss</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Import, log, and see the recurring reasons behind every deal, across every competitor.
        </p>
        <div className="mt-4">
          <WinLossPageClient
            competitors={(competitors ?? []).map((c) => ({ id: c.id, name: c.name }))}
            initialEntries={winLossEntries ?? []}
            hubspotConnected={Boolean(hubspotIntegration)}
            showWinLoss={Boolean(account?.has_sales_crm) || !account?.has_plg}
            showChurn={Boolean(account?.has_plg)}
          />
        </div>
      </section>

      <section id="news" className="mt-10 scroll-mt-20">
        <h2 className="text-sm font-semibold">News</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Signals across every tracked competitor. Scored alerts include the reasoning behind the verdict.
        </p>
        <div className="mt-4">
          <DashboardFeed
            competitors={competitors ?? []}
            signals={signals ?? []}
            evalLabelBySignalId={evalLabelBySignalId}
            tier={tier}
            previewContext={{
              companyName: account?.name ?? "",
              positioning: account?.positioning ?? "",
              icp: account?.icp ?? "",
              lossReason: account?.lost_deal_notes || account?.churn_notes || "",
            }}
          />
        </div>
      </section>

      <section id="pricing" className="mt-10 scroll-mt-20">
        <h2 className="text-sm font-semibold">Competitor pricing</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Each competitor&apos;s current tiers, features, and how they actually charge.
        </p>
        <div className="mt-4">
          <PricingBoard competitors={competitors ?? []} pricing={pricing ?? []} pricingSignals={pricingSignals ?? []} />
        </div>
      </section>
    </div>
  );
}
