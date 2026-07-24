"use client";

import { useState } from "react";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { IntegrationConnector } from "@/components/app/integration-connector";
import { TeamManager } from "@/components/app/team-manager";
import { BillingPeriodToggle, type BillingPeriod } from "@/components/marketing/billing-period-toggle";
import { TIERS } from "@/lib/tiers";
import { ANNUAL_DISCOUNT_PERCENT } from "@/lib/pricing";
import { CRM_ALLOWED, CALL_INTEL_ALLOWED } from "@/lib/tier-limits";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { TIER_BADGE } from "@/lib/tier-style";
import { disconnectIntegrationAction } from "./actions";
import type { Database } from "@/lib/supabase/types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];
type Competitor = Database["public"]["Tables"]["competitors"]["Row"];
type Integration = Database["public"]["Tables"]["integrations"]["Row"];
type Signal = Database["public"]["Tables"]["signals"]["Row"];

export function SettingsView({
  account,
  competitors,
  integrations,
  recentSignals,
  currentUserId,
}: {
  account: Account;
  competitors: Competitor[];
  integrations: Integration[];
  recentSignals: Signal[];
  currentUserId: string;
}) {
  const [error, setError] = useState("");
  const [billingLoading, setBillingLoading] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");

  const currentTier = TIERS.find((t) => t.id === account.tier) ?? TIERS[0];
  const isConnected = (provider: string) => integrations.some((i) => i.provider === provider && i.connected);

  async function handleManageBilling() {
    setBillingLoading("portal");
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    setBillingLoading(null);
    if (res.ok) window.location.href = data.url;
    else setError(data.error ?? "Could not open billing portal.");
  }

  async function handleUpgrade(tier: "starter" | "plus" | "advanced") {
    setBillingLoading(tier);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, period: billingPeriod }),
    });
    const data = await res.json();
    setBillingLoading(null);
    if (res.ok) window.location.href = data.url;
    else setError(data.error ?? "Could not start checkout.");
  }

  return (
    <Tabs defaultValue="integrations">
      <TabsList>
        <TabsTrigger value="integrations">Integrations</TabsTrigger>
        <TabsTrigger value="team">Team</TabsTrigger>
        <TabsTrigger value="plan">Plan</TabsTrigger>
        <TabsTrigger value="digest">Digest preview</TabsTrigger>
      </TabsList>

      <TabsContent value="team" className="mt-6">
        <Card>
          <CardHeader>
            <h2 className="font-medium">Team</h2>
            <p className="text-sm text-muted-foreground">
              Invite co-workers to your workspace — everyone shares the same competitors and alerts.
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
                  : "Read-only pull of closed-lost deal reasons — Plus and above"
              }
              connected={isConnected("hubspot")}
              connectHref="/api/integrations/hubspot/connect"
              provider="hubspot"
              disconnectAction={disconnectIntegrationAction}
              requiresUpgrade={!CRM_ALLOWED[account.tier]}
            />
            <IntegrationConnector
              name="Intercom"
              description="Read-only pull of churn and cancellation reasons"
              connected={false}
              connectHref="#"
              provider="intercom"
              comingSoon
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
              description={
                CALL_INTEL_ALLOWED[account.tier]
                  ? "Pull competitor mentions from recent sales calls"
                  : "Pull competitor mentions from recent sales calls — Plus and above"
              }
              connected={isConnected("gong")}
              connectHref="/api/integrations/gong/connect"
              provider="gong"
              disconnectAction={disconnectIntegrationAction}
              requiresUpgrade={!CALL_INTEL_ALLOWED[account.tier]}
            />
            <IntegrationConnector
              name="Zoom"
              description={
                CALL_INTEL_ALLOWED[account.tier]
                  ? "Pull competitor mentions from recorded meeting transcripts"
                  : "Pull competitor mentions from recorded meeting transcripts — Plus and above"
              }
              connected={isConnected("zoom")}
              connectHref="/api/integrations/zoom/connect"
              provider="zoom"
              disconnectAction={disconnectIntegrationAction}
              requiresUpgrade={!CALL_INTEL_ALLOWED[account.tier]}
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
              {account.stripe_customer_id ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleManageBilling}
                  disabled={billingLoading !== null}
                >
                  {billingLoading === "portal" ? <Loader2 className="size-4 animate-spin" /> : null}
                  Manage billing
                </Button>
              ) : (
                <>
                  {account.tier !== "starter" ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleUpgrade("starter")}
                      disabled={billingLoading !== null}
                    >
                      {billingLoading === "starter" ? <Loader2 className="size-4 animate-spin" /> : null}
                      Switch to Starter
                    </Button>
                  ) : null}
                  {account.tier !== "plus" ? (
                    <Button
                      type="button"
                      onClick={() => handleUpgrade("plus")}
                      disabled={billingLoading !== null}
                    >
                      {billingLoading === "plus" ? <Loader2 className="size-4 animate-spin" /> : null}
                      Upgrade to Plus
                    </Button>
                  ) : null}
                  {account.tier !== "advanced" ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleUpgrade("advanced")}
                      disabled={billingLoading !== null}
                    >
                      {billingLoading === "advanced" ? <Loader2 className="size-4 animate-spin" /> : null}
                      Upgrade to Advanced
                    </Button>
                  ) : null}
                </>
              )}
              <Link href="/pricing" className={buttonVariants({ variant: "ghost" })}>
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
              No signals yet — once crawling picks something up, this tab will preview exactly what
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
                            {signal.relevance_level} relevance — {signal.relevance_reasoning}
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
    </Tabs>
  );
}
