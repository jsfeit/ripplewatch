"use client";

import { useEffect, useState } from "react";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { IntegrationConnector } from "@/components/app/integration-connector";
import { TeamManager } from "@/components/app/team-manager";
import { ApiKeysManager } from "@/components/app/api-keys-manager";
import { CompetitorManager } from "@/components/app/competitor-manager";
import { SuggestedCompetitorsPanel } from "@/components/app/suggested-competitors-panel";
import { ThemeToggle } from "@/components/app/theme-toggle";
import type { MomentumResult } from "@/lib/momentum";
import { BillingPeriodToggle, type BillingPeriod } from "@/components/marketing/billing-period-toggle";
import { TIERS } from "@/lib/tiers";
import { ANNUAL_DISCOUNT_PERCENT, annualPriceUsd } from "@/lib/pricing";
import { trackEvent } from "@/lib/analytics";
import { CRM_ALLOWED, CALL_INTEL_ALLOWED, INTERCOM_ALLOWED, API_ACCESS_ALLOWED } from "@/lib/tier-limits";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { TIER_BADGE } from "@/lib/tier-style";
import { disconnectIntegrationAction } from "./actions";
import { EmbeddedCheckoutModal } from "@/components/app/embedded-checkout-modal";
import type { Database } from "@/lib/supabase/types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];
type Competitor = Database["public"]["Tables"]["competitors"]["Row"];
type Suggestion = Database["public"]["Tables"]["suggested_competitors"]["Row"];
type Integration = Database["public"]["Tables"]["integrations"]["Row"];
type Signal = Database["public"]["Tables"]["signals"]["Row"];
type ApiKey = Pick<
  Database["public"]["Tables"]["api_keys"]["Row"],
  "id" | "name" | "key_prefix" | "last_used_at" | "created_at"
>;

const KNOWN_TABS = ["competitors", "integrations", "team", "plan", "digest", "developer", "appearance"] as const;

export function SettingsView({
  account,
  competitors,
  suggestions,
  momentum,
  traffic,
  seoAllowed,
  integrations,
  recentSignals,
  apiKeys,
  currentUserId,
}: {
  account: Account;
  competitors: Competitor[];
  suggestions: Suggestion[];
  momentum: Record<string, MomentumResult>;
  traffic: Record<string, number | null>;
  seoAllowed: boolean;
  integrations: Integration[];
  recentSignals: Signal[];
  apiKeys: ApiKey[];
  currentUserId: string;
}) {
  const [error, setError] = useState("");
  const [billingLoading, setBillingLoading] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  const [checkoutModal, setCheckoutModal] = useState<{
    tier: "starter" | "plus" | "advanced";
    period: "monthly" | "annual";
  } | null>(null);

  const currentTier = TIERS.find((t) => t.id === account.tier) ?? TIERS[0];
  const isConnected = (provider: string) => integrations.some((i) => i.provider === provider && i.connected);

  // Lets a direct/bookmarked link to /app/settings?tab=plan (or
  // ?tab=competitors, from the old /app/competitors redirect) land on that
  // tab instead of always opening on Integrations. Read in an effect (not a
  // lazy useState initializer) so the server-rendered and first-client-render
  // markup always agree on "integrations", avoiding a hydration mismatch;
  // the effect then flips tabs post-mount. This only fires once on mount,
  // so it doesn't cover in-app "Upgrade to connect" clicks below (those call
  // setActiveTab directly via onUpgradeClick instead).
  const [activeTab, setActiveTab] = useState("integrations");

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab && (KNOWN_TABS as readonly string[]).includes(tab)) {
      // Syncing one-time from an external system (the URL) on mount —
      // the case the rule's own guidance calls out as fine.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(tab);
    }
  }, []);

  // Fires once on landing back from Stripe's embedded Checkout via
  // return_url. Reads window.location directly (not useSearchParams) so
  // this doesn't need a Suspense boundary. The bare ?checkout=success query
  // param used to be trusted on its own — spoofable (anyone can type the
  // URL) and re-fires on every refresh of that exact URL, which would have
  // fed Google Ads/GA4 phantom, duplicate, zero-value conversions. Now
  // verifies the session actually paid server-side, dedupes permanently by
  // session_id in localStorage (not sessionStorage — a refresh in the same
  // tab shouldn't re-fire it either), and passes the real charged amount so
  // the event is usable for value-based ad bidding, not just a raw count.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (params.get("checkout") !== "success" || !sessionId) return;

    const dedupeKey = `rw-purchase-tracked-${sessionId}`;
    if (localStorage.getItem(dedupeKey)) return;

    fetch(`/api/stripe/checkout-session?session_id=${encodeURIComponent(sessionId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.paid) return;
        localStorage.setItem(dedupeKey, "1");
        trackEvent("purchase", {
          currency: (data.currency ?? "usd").toUpperCase(),
          value: data.amountTotal ?? undefined,
          transaction_id: sessionId,
        });
        // Same guard the Rewardful snippet itself relies on: window.rewardful
        // is only ever defined when cookie consent was granted (see
        // cookie-consent.tsx) — declined/not-yet-decided consent means the
        // script never loaded, so this silently no-ops rather than throwing.
        const rewardful = (window as typeof window & { rewardful?: (...args: unknown[]) => void }).rewardful;
        if (data.customerEmail && typeof rewardful === "function") {
          rewardful("convert", { email: data.customerEmail });
        }
      })
      .catch(() => {});
  }, []);

  async function handleManageBilling() {
    setBillingLoading("portal");
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    setBillingLoading(null);
    if (res.ok) window.location.href = data.url;
    else setError(data.error ?? "Could not open billing portal.");
  }

  // Existing subscribers go through /api/stripe/change-plan — a deep link
  // straight into the Stripe Portal's "confirm this change" screen, already
  // pre-filled with their card and email. Routing them through /checkout
  // instead would create a second, simultaneous subscription rather than
  // changing the one they have. Brand-new customers (no subscription yet)
  // open the embedded Checkout modal instead — there's nothing to "change"
  // for them, and this is their first payment, not a plan switch.
  async function handleUpgrade(tier: "starter" | "plus" | "advanced") {
    const hasActiveSubscription = Boolean(account.stripe_customer_id && account.stripe_subscription_id);

    if (!hasActiveSubscription) {
      const monthlyUsd = TIERS.find((t) => t.id === tier)?.monthlyUsd ?? 0;
      const value = billingPeriod === "annual" ? annualPriceUsd(monthlyUsd) : monthlyUsd;
      trackEvent("begin_checkout", { currency: "USD", value, item_name: tier, item_variant: billingPeriod });
      setCheckoutModal({ tier, period: billingPeriod });
      return;
    }

    setBillingLoading(tier);
    const res = await fetch("/api/stripe/change-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    const data = await res.json();
    setBillingLoading(null);
    if (res.ok) {
      // Full navigation to Stripe Portal, not a client-side route change —
      // a plain click-handler side effect, not render/effect state.
      // eslint-disable-next-line react-hooks/immutability
      window.location.href = data.url;
    } else {
      setError(data.error ?? "Could not start checkout.");
    }
  }

  return (
    <>
      <EmbeddedCheckoutModal
        open={checkoutModal !== null}
        onOpenChange={(open) => {
          if (!open) setCheckoutModal(null);
        }}
        tier={checkoutModal?.tier ?? "starter"}
        period={checkoutModal?.period ?? "monthly"}
      />
      <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="competitors">Competitors</TabsTrigger>
        <TabsTrigger value="integrations">Integrations</TabsTrigger>
        <TabsTrigger value="team">Team</TabsTrigger>
        <TabsTrigger value="plan">Plan</TabsTrigger>
        <TabsTrigger value="digest">Digest preview</TabsTrigger>
        <TabsTrigger value="developer">Developer</TabsTrigger>
        <TabsTrigger value="appearance">Appearance</TabsTrigger>
      </TabsList>

      <TabsContent value="competitors" className="mt-6 space-y-6">
        <SuggestedCompetitorsPanel suggestions={suggestions} />
        <CompetitorManager
          competitors={competitors}
          tier={account.tier}
          momentum={momentum}
          traffic={traffic}
          seoAllowed={seoAllowed}
        />
      </TabsContent>

      <TabsContent value="team" className="mt-6">
        <Card>
          <CardHeader>
            <h2 className="font-medium">Team</h2>
            <p className="text-sm text-muted-foreground">
              Invite co-workers to your workspace; everyone shares the same competitors and alerts.
            </p>
          </CardHeader>
          <CardContent>
            <TeamManager tier={account.tier} currentUserId={currentUserId} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="integrations" className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <h2 className="font-medium">Delivery</h2>
            <p className="text-sm text-muted-foreground">Where scored alerts get sent.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <IntegrationConnector
              name="Slack"
              description="Deliver scored alerts to a channel"
              connected={isConnected("slack")}
              connectHref="/api/integrations/slack/connect"
              provider="slack"
              disconnectAction={disconnectIntegrationAction}
            />
            <IntegrationConnector
              name="Email"
              description={`Digests delivered to ${account.contact_email ?? "your signup email"}`}
              connected={Boolean(account.contact_email)}
              connectHref="#"
              provider="email"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-medium">CRM</h2>
            <p className="text-sm text-muted-foreground">
              Read-only pull of closed-lost deal and churn reasons.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <IntegrationConnector
              name="HubSpot"
              description={
                CRM_ALLOWED[account.tier]
                  ? "Read-only pull of closed-lost deal reasons"
                  : "Read-only pull of closed-lost deal reasons, Plus and above"
              }
              connected={isConnected("hubspot")}
              connectHref="/api/integrations/hubspot/connect"
              provider="hubspot"
              disconnectAction={disconnectIntegrationAction}
              requiresUpgrade={!CRM_ALLOWED[account.tier]}
              onUpgradeClick={() => setActiveTab("plan")}
            />
            <IntegrationConnector
              name="Intercom"
              description={
                INTERCOM_ALLOWED[account.tier]
                  ? "Read-only pull of churn and cancellation reasons"
                  : "Read-only pull of churn and cancellation reasons, Advanced only"
              }
              connected={isConnected("intercom")}
              connectHref="/api/integrations/intercom/connect"
              provider="intercom"
              disconnectAction={disconnectIntegrationAction}
              requiresUpgrade={!INTERCOM_ALLOWED[account.tier]}
              onUpgradeClick={() => setActiveTab("plan")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-medium">Sales</h2>
            <p className="text-sm text-muted-foreground">
              Competitor mentions pulled from sales call transcripts.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <IntegrationConnector
              name="Gong"
              description="Pull competitor mentions from recent sales calls"
              connected={false}
              connectHref="#"
              provider="gong"
              comingSoon
            />
            <IntegrationConnector
              name="Zoom"
              description={
                CALL_INTEL_ALLOWED[account.tier]
                  ? "Pull competitor mentions from recorded meeting transcripts"
                  : "Pull competitor mentions from recorded meeting transcripts, Advanced only"
              }
              connected={isConnected("zoom")}
              connectHref="/api/integrations/zoom/connect"
              provider="zoom"
              disconnectAction={disconnectIntegrationAction}
              requiresUpgrade={!CALL_INTEL_ALLOWED[account.tier]}
              onUpgradeClick={() => setActiveTab("plan")}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="plan" className="mt-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Current plan</h2>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TIER_BADGE[account.tier] ?? TIER_BADGE.starter}`}
              >
                {currentTier.name}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {account.subscription_status && !["active", "trialing"].includes(account.subscription_status) ? (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
                  Your subscription is <strong>{account.subscription_status.replace("_", " ")}</strong>.{" "}
                  {account.subscription_status === "past_due"
                    ? "Update your payment method to avoid losing access."
                    : "Manage billing to resolve this."}
                </p>
              </div>
            ) : null}
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-3xl font-semibold tracking-tight">
                {currentTier.price}
                <span className="text-sm font-normal text-muted-foreground">{currentTier.priceNote}</span>
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {[currentTier.competitors, currentTier.signalSources, currentTier.relevanceScoring, currentTier.delivery].map(
                  (line) => (
                    <li key={line} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      {line}
                    </li>
                  )
                )}
              </ul>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {!account.stripe_customer_id ? (
              <BillingPeriodToggle
                period={billingPeriod}
                onChange={setBillingPeriod}
                discountPercent={ANNUAL_DISCOUNT_PERCENT}
              />
            ) : null}
            <div className="flex flex-wrap gap-2">
              {TIERS.filter((t) => t.id !== account.tier).map((t) => {
                const isUpgrade = TIERS.findIndex((x) => x.id === t.id) > TIERS.findIndex((x) => x.id === account.tier);
                return (
                  <Button
                    key={t.id}
                    type="button"
                    variant={isUpgrade ? "default" : "outline"}
                    onClick={() => handleUpgrade(t.id)}
                    disabled={billingLoading !== null}
                  >
                    {billingLoading === t.id ? <Loader2 className="size-4 animate-spin" /> : null}
                    {isUpgrade ? "Upgrade to" : "Downgrade to"} {t.name}
                  </Button>
                );
              })}
              {account.stripe_customer_id ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleManageBilling}
                  disabled={billingLoading !== null}
                >
                  {billingLoading === "portal" ? <Loader2 className="size-4 animate-spin" /> : null}
                  Manage billing
                </Button>
              ) : null}
              <Link href="/app/settings?tab=plan" className={buttonVariants({ variant: "ghost" })}>
                Compare plans
              </Link>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="digest" className="mt-6 space-y-6">
        {recentSignals.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No signals yet; once crawling picks something up, this tab will preview exactly what
              gets sent to Slack and email.
            </CardContent>
          </Card>
        ) : (
          <>
            {(() => {
              const topScored = recentSignals.find((s) => s.scored) ?? recentSignals[0];
              const competitorName =
                competitors.find((c) => c.id === topScored.competitor_id)?.name ?? "A competitor";
              return (
                <Card>
                  <CardHeader>
                    <h2 className="font-medium">Slack digest preview</h2>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border border-border bg-[#1a1d21] p-4 font-sans text-sm text-white">
                      <div className="flex items-center gap-2 font-semibold">
                        <span className="flex size-6 items-center justify-center rounded bg-primary text-[10px] text-primary-foreground">
                          R
                        </span>
                        Ripplewatch
                        <span className="text-xs font-normal text-white/50">APP</span>
                      </div>
                      <p className="mt-2 flex items-center gap-1 font-medium">
                        {topScored.scored ? (
                          <>
                            <Sparkles className="size-3.5 text-primary" />
                            {topScored.relevance_level} relevance alert on {competitorName}
                          </>
                        ) : (
                          `Raw signal on ${competitorName}`
                        )}
                      </p>
                      <p className="mt-1 text-white/80">
                        {topScored.scored ? topScored.relevance_reasoning : topScored.title}
                      </p>
                      <p className="mt-2 text-xs text-white/50">View in Ripplewatch →</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            <Card>
              <CardHeader>
                <h2 className="font-medium">Email digest preview</h2>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border p-5">
                  <p className="text-xs text-muted-foreground">Your competitive landscape</p>
                  <h3 className="mt-1 text-lg font-semibold">
                    {recentSignals.length} signal{recentSignals.length === 1 ? "" : "s"},{" "}
                    {recentSignals.filter((s) => s.scored).length} worth acting on
                  </h3>
                  <div className="mt-4 space-y-3 text-sm">
                    {recentSignals.slice(0, 5).map((signal) => {
                      const competitorName =
                        competitors.find((c) => c.id === signal.competitor_id)?.name ?? "Unknown";
                      return signal.scored ? (
                        <div key={signal.id} className="rounded-md border border-primary/20 bg-accent/50 p-3">
                          <p className="font-medium">
                            {competitorName} · {signal.title}
                          </p>
                          <p className="text-muted-foreground">
                            {signal.relevance_level} relevance: {signal.relevance_reasoning}
                          </p>
                        </div>
                      ) : (
                        <div key={signal.id} className="rounded-md border border-border p-3 text-muted-foreground">
                          {competitorName} · {signal.title}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </TabsContent>

      <TabsContent value="developer" className="mt-6">
        <Card>
          <CardHeader>
            <h2 className="font-medium">API access</h2>
          </CardHeader>
          <CardContent>
            {API_ACCESS_ALLOWED[account.tier] ? (
              <ApiKeysManager initialKeys={apiKeys} />
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
                  API access is a Plus/Advanced feature.{" "}
                  <button
                    type="button"
                    onClick={() => setActiveTab("plan")}
                    className="underline underline-offset-2"
                  >
                    Upgrade
                  </button>{" "}
                  to generate keys.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="appearance" className="mt-6">
        <Card>
          <CardHeader>
            <h2 className="font-medium">Appearance</h2>
            <p className="text-sm text-muted-foreground">
              Light and dark are built in — System matches your device automatically.
            </p>
          </CardHeader>
          <CardContent>
            <ThemeToggle />
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>
    </>
  );
}
