"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TIERS } from "@/lib/tiers";
import { ANNUAL_DISCOUNT_PERCENT, annualPriceUsd } from "@/lib/pricing";
import { CONNECT_FEATURES, CONNECT_NAME, CONNECT_TAGLINE } from "@/lib/connect";
import { CONNECT_BASE_FEE_USD, CONNECT_MIN_FUNDING_USD } from "@/lib/connect-pricing";
import { BillingPeriodToggle, type BillingPeriod } from "./billing-period-toggle";

// Connect leads (cheaper, self-serve, the recommended way in); the dashboard
// is the one plan next to it for a team that wants a shared UI. The billing
// toggle only affects the dashboard's price — Connect's platform fee doesn't
// have an annual option.
export function PricingCards() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const dashboard = TIERS[0];
  const dashboardMonthly = period === "annual" ? annualPriceUsd(dashboard.monthlyUsd) / 12 : dashboard.monthlyUsd;

  return (
    <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2 sm:items-start">
      <div className="relative">
        <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          Cheapest way in
        </span>
        <Card className="flex h-full flex-col border-primary shadow-md shadow-primary/10">
          <CardHeader>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              {CONNECT_NAME}
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-semibold tracking-tight">${CONNECT_BASE_FEE_USD}</span>
              <span className="text-sm text-muted-foreground">/mo + usage</span>
            </div>
            <p className="text-xs text-primary">Usage comes from a balance you prepay, from ${CONNECT_MIN_FUNDING_USD}.</p>
            <p className="text-sm text-muted-foreground">{CONNECT_TAGLINE}</p>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            <ul className="flex-1 space-y-3 text-sm">
              {CONNECT_FEATURES.map((f) => (
                <FeatureRow key={f} label={f} />
              ))}
              <FeatureRow label="Pay only for what you use, never on credit" />
            </ul>
            <Link href="/onboarding?path=connect" className={buttonVariants({ className: "w-full" })}>
              Get {CONNECT_NAME}
            </Link>
            <p className="text-center text-xs text-muted-foreground">
              No dashboard, no seat fee.{" "}
              <Link href="/connect" className="underline underline-offset-2 hover:text-foreground">
                How it works
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="flex h-full flex-col">
        <CardHeader>
          <p className="text-sm font-semibold text-muted-foreground">{dashboard.name}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-semibold tracking-tight">
              $
              {dashboardMonthly.toLocaleString(undefined, {
                minimumFractionDigits: dashboardMonthly % 1 === 0 ? 0 : 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-sm text-muted-foreground">/mo</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {period === "annual"
              ? `billed $${annualPriceUsd(dashboard.monthlyUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/yr`
              : dashboard.annualNote}
          </p>
          <p className="text-sm text-muted-foreground">{dashboard.tagline}</p>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3">
          <ul className="flex-1 space-y-3 text-sm">
            <FeatureRow label={dashboard.competitors} />
            <FeatureRow label={dashboard.signalSources} />
            <FeatureRow label={dashboard.relevanceScoring} />
            {dashboard.onboarding ? <FeatureRow label={dashboard.onboarding} /> : null}
            <FeatureRow label={dashboard.delivery} />
            {dashboard.crm ? <FeatureRow label={dashboard.crm} /> : null}
            {dashboard.callIntel ? <FeatureRow label={dashboard.callIntel} /> : null}
            {dashboard.gong ? <FeatureRow label={dashboard.gong} /> : null}
            {dashboard.intercom ? <FeatureRow label={dashboard.intercom} /> : null}
            {dashboard.apiAccess ? <FeatureRow label={dashboard.apiAccess} /> : null}
            {dashboard.visualDiff ? <FeatureRow label={dashboard.visualDiff} /> : null}
            <FeatureRow label="Unlimited logins" />
          </ul>
          <Link
            href={`/onboarding?plan=${dashboard.id}&period=${period}`}
            className={buttonVariants({ variant: "outline", className: "w-full" })}
          >
            {dashboard.cta}
          </Link>
          <div className="flex justify-center pt-1">
            <BillingPeriodToggle period={period} onChange={setPeriod} discountPercent={ANNUAL_DISCOUNT_PERCENT} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FeatureRow({ label }: { label: string }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
      <span>{label}</span>
    </li>
  );
}
