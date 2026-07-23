"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TIERS } from "@/lib/tiers";
import { ANNUAL_DISCOUNT_PERCENT, annualPriceUsd } from "@/lib/pricing";
import { BillingPeriodToggle, type BillingPeriod } from "./billing-period-toggle";

export function PricingCards() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  return (
    <div>
      <div className="flex justify-center">
        <BillingPeriodToggle period={period} onChange={setPeriod} discountPercent={ANNUAL_DISCOUNT_PERCENT} />
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {TIERS.map((tier) => {
          const displayMonthly = period === "annual" ? annualPriceUsd(tier.monthlyUsd) / 12 : tier.monthlyUsd;
          const href = tier.selfServe ? `/signup?plan=${tier.id}&period=${period}` : "/waitlist";

          return (
            <div key={tier.id} className="relative">
              {tier.highlight ? (
                <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Most popular
                </span>
              ) : null}
              <Card
                className={cn(
                  "flex h-full flex-col",
                  tier.highlight && "border-primary shadow-md shadow-primary/10"
                )}
              >
                <CardHeader>
                  <p className="text-sm font-semibold text-muted-foreground">{tier.name}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tracking-tight">
                      $
                      {displayMonthly.toLocaleString(undefined, {
                        minimumFractionDigits: displayMonthly % 1 === 0 ? 0 : 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                  <p className="text-xs text-primary">
                    {period === "annual"
                      ? `billed $${annualPriceUsd(tier.monthlyUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/yr`
                      : tier.annualNote}
                  </p>
                  <p className="text-sm text-muted-foreground">{tier.tagline}</p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <ul className="flex-1 space-y-3 text-sm">
                    <FeatureRow label={tier.competitors} />
                    <FeatureRow label={tier.signalSources} />
                    <FeatureRow label={tier.relevanceScoring} />
                    <FeatureRow label={tier.onboarding} />
                    <FeatureRow label={tier.delivery} />
                    <FeatureRow label={tier.crm} />
                    <FeatureRow label={tier.seats === "Unlimited" ? "Unlimited logins" : tier.seats} />
                  </ul>
                  <Link
                    href={href}
                    className={buttonVariants({
                      variant: tier.highlight ? "default" : "outline",
                      className: "w-full",
                    })}
                  >
                    {tier.cta}
                  </Link>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
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
