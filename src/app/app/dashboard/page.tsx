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
import { HiringBoard } from "../hiring/hiring-board";
import { WinLossPageClient } from "../win-loss/win-loss-page-client";
import { AutoProductTour } from "@/components/app/product-tour";
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
  { id: "hiring", label: "Hiring" },
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

  const { accountId, db, impersonation } = await resolveAccountContext(supabase, user.id);
  if (!accountId) redirect("/onboarding");

  // account and competitors don't depend on each other — fetched together
  // instead of two sequential round-trips. The tour flag is read from the
  // caller's own profile (never db, which is the admin client scoped to the
  // impersonated account during impersonation) and skipped outright below
  // when impersonating, so an admin looking at someone else's account never
  // triggers or marks seen the tour on their own profile.
  const [{ data: account }, { data: competitors }, { data: profileTour }] = await Promise.all([
    db
      .from("accounts")
      .select(
        "name, positioning, icp, lost_deal_notes, churn_notes, tier, has_sales_crm, has_plg, weekly_verdict, weekly_verdict_generated_at, trends_digest, trends_digest_generated_at"
      )
      .eq("id", accountId)
      .single(),
    db
      .from("competitors")
      .select("id, name, pricing_url, careers_url")
      .eq("account_id", accountId)
      .order("created_at", { ascending: true }),
    impersonation
      ? { data: null }
      : supabase.from("profiles").select("has_seen_product_tour").eq("id", user.id).maybeSingle(),
  ]);
  // Defaults to "seen" (never auto-fires) on any ambiguity: impersonating,
  // the migration not applied yet, or an unexpected query error.
  const hasSeenTour = impersonation ? true : (profileTour?.has_seen_product_tour ?? true);
  const tier = account?.tier ?? "starter";
  const seoAllowed = TIER_SIGNAL_SOURCES[tier].includes("seo");
  const competitorIds = (competitors ?? []).map((c) => c.id);

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

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 60);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 6);

  // Everything below depends only on competitorIds/accountId/seoAllowed,
  // none of it on each other — fetched as one batch of round-trips instead
  // of sequentially.
  const [
    { data: signals },
    { data: pricing },
    { data: pricingSignals },
    { data: hiring },
    { data: hiringSignals },
    { data: seo },
    { data: seoSignals },
    { data: momentumSignals },
    { data: activitySignals },
    { data: industryTrends },
    { data: winLossTrends },
    { data: winLossEntries },
    { data: hubspotIntegration },
  ] = await Promise.all([
    // --- News --- (SEO/traffic signals surface in Trends below, not here)
    competitorIds.length
      ? db
          .from("signals")
          .select("id, competitor_id, type, title, summary, scored, relevance_level, relevance_score, relevance_reasoning, url, occurred_on")
          .in("competitor_id", competitorIds)
          .neq("type", "seo")
          .order("occurred_on", { ascending: false })
      : Promise.resolve({ data: [] as Signal[] }),
    // --- Competitor pricing ---
    competitorIds.length
      ? db.from("competitor_pricing").select("competitor_id, billing_model, tiers, publicly_priced, note, last_checked_at").in("competitor_id", competitorIds)
      : Promise.resolve({ data: [] }),
    competitorIds.length
      ? db
          .from("signals")
          .select("competitor_id, created_at")
          .in("competitor_id", competitorIds)
          .eq("type", "pricing")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    // --- Hiring ---
    competitorIds.length
      ? db
          .from("competitor_hiring")
          .select("competitor_id, open_role_count, department_breakdown, source, last_checked_at")
          .in("competitor_id", competitorIds)
      : Promise.resolve({ data: [] }),
    competitorIds.length
      ? db
          .from("signals")
          .select("competitor_id, created_at")
          .in("competitor_id", competitorIds)
          .eq("type", "job_posting")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    // --- Trends: momentum + industry pulse ---
    seoAllowed && competitorIds.length
      ? db.from("competitor_seo").select("competitor_id, traffic_trend, organic_traffic_estimate, last_checked_at").in("competitor_id", competitorIds)
      : Promise.resolve({ data: [] }),
    seoAllowed && competitorIds.length
      ? db
          .from("signals")
          .select("competitor_id, created_at")
          .in("competitor_id", competitorIds)
          .eq("type", "seo")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    competitorIds.length
      ? db
          .from("signals")
          .select("competitor_id, type, occurred_on, scored, relevance_score")
          .in("competitor_id", competitorIds)
          .gte("occurred_on", sixtyDaysAgo.toISOString().slice(0, 10))
      : Promise.resolve({ data: [] }),
    competitorIds.length
      ? db
          .from("signals")
          .select("type, occurred_on")
          .in("competitor_id", competitorIds)
          .in("type", ["job_posting", "pricing"])
          .gte("occurred_on", sixMonthsAgo.toISOString().slice(0, 10))
      : Promise.resolve({ data: [] }),
    db
      .from("industry_trends")
      .select("trends, generated_at")
      .eq("account_id", accountId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // --- Trends: recurring win/loss themes ---
    db
      .from("win_loss_trends")
      .select("id, theme, summary, won_count, lost_count, example_reasons, related_signals, generated_at")
      .eq("account_id", accountId)
      .order("won_count", { ascending: false }),
    // --- Win/loss log ---
    competitorIds.length
      ? db
          .from("competitor_win_loss")
          .select("id, competitor_id, outcome, reason, created_at")
          .in("competitor_id", competitorIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    db
      .from("integrations")
      .select("connected")
      .eq("account_id", accountId)
      .eq("provider", "hubspot")
      .eq("connected", true)
      .maybeSingle(),
  ]);

  const pricingByCompetitor = Object.fromEntries((pricing ?? []).map((p) => [p.competitor_id, p]));
  const monthlyActivity = bucketMonthlyActivity(activitySignals ?? []);
  const trendSignalIds = Array.from(
    new Set((winLossTrends ?? []).flatMap((t) => t.related_signals.map((r) => r.signalId)))
  );
  const trendsGeneratedAt = winLossTrends && winLossTrends.length > 0 ? winLossTrends[0].generated_at : null;

  // Last batch: depends on signal/trend ids resolved above.
  const [{ data: evalLabels }, { data: relatedSignals }] = await Promise.all([
    signals && signals.length
      ? db.from("signal_eval_labels").select("signal_id, label").in("signal_id", signals.map((s) => s.id))
      : Promise.resolve({ data: [] }),
    trendSignalIds.length
      ? db.from("signals").select("id, title, url, type, occurred_on").in("id", trendSignalIds)
      : Promise.resolve({ data: [] }),
  ]);
  const evalLabelBySignalId = Object.fromEntries((evalLabels ?? []).map((l) => [l.signal_id, l.label]));

  // Most recent signal per competitor, for the overview strip — `signals`
  // is already ordered occurred_on desc, so the first match per
  // competitor_id is the latest.
  const latestSignalByCompetitor: Record<string, Pick<Signal, "title">> = {};
  for (const signal of signals ?? []) {
    if (!(signal.competitor_id in latestSignalByCompetitor)) latestSignalByCompetitor[signal.competitor_id] = signal;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-10 sm:py-10">
      <AutoProductTour hasSeenTour={hasSeenTour} />
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

      <section id="hiring" className="mt-10 scroll-mt-20">
        <h2 className="text-sm font-semibold">Hiring</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Open roles and department mix, scraped from each competitor&apos;s careers page.
        </p>
        <div className="mt-4">
          <HiringBoard competitors={competitors ?? []} hiring={hiring ?? []} hiringSignals={hiringSignals ?? []} />
        </div>
      </section>
    </div>
  );
}
