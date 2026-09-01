"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BillingPeriodToggle, type BillingPeriod } from "@/components/marketing/billing-period-toggle";
import { EmbeddedCheckoutModal } from "@/components/app/embedded-checkout-modal";
import { TIERS } from "@/lib/tiers";
import { ANNUAL_DISCOUNT_PERCENT, annualPriceUsd } from "@/lib/pricing";
import { trackEvent } from "@/lib/analytics";

export function ReactivateView({ companyName }: { companyName: string }) {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  const [checkoutTier, setCheckoutTier] = useState<"starter" | "plus" | "advanced" | null>(null);

  function pickTier(tier: "starter" | "plus" | "advanced") {
    const monthlyUsd = TIERS.find((t) => t.id === tier)?.monthlyUsd ?? 0;
    const value = billingPeriod === "annual" ? annualPriceUsd(monthlyUsd) : monthlyUsd;
    trackEvent("begin_checkout", { currency: "USD", value, item_name: tier, item_variant: billingPeriod });
    setCheckoutTier(tier);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-10">
      <EmbeddedCheckoutModal
        open={checkoutTier !== null}
        onOpenChange={(open) => {
          if (!open) setCheckoutTier(null);
        }}
        tier={checkoutTier ?? "starter"}
        period={billingPeriod}
        returnPath="/app/dashboard"
      />

      <h1 className="text-2xl font-semibold tracking-tight">Reactivate your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {companyName}&apos;s subscription ended, so monitoring is paused — your competitors, signals, and
        history are all still here. Pick a plan to pick up where you left off.
      </p>

      <div className="mt-6">
        <BillingPeriodToggle period={billingPeriod} onChange={setBillingPeriod} discountPercent={ANNUAL_DISCOUNT_PERCENT} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {TIERS.map((t) => (
          <Card key={t.id} className={t.highlight ? "border-primary" : undefined}>
            <CardHeader>
              <h2 className="font-medium">{t.name}</h2>
              <p className="text-2xl font-semibold tracking-tight">
                {t.price}
                <span className="text-sm font-normal text-muted-foreground">{t.priceNote}</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {[t.competitors, t.signalSources, t.relevanceScoring].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    {line}
                  </li>
                ))}
              </ul>
              <Button type="button" className="w-full" onClick={() => pickTier(t.id)}>
                Reactivate with {t.name}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
