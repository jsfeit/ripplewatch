import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { CONNECT_PRICING_FEATURES, CONNECT_NAME, CONNECT_TAGLINE } from "@/lib/connect";
import {
  CONNECT_BASE_FEE_USD,
  CONNECT_DEFAULT_RELOAD_USD,
  CONNECT_MIN_FUNDING_USD,
} from "@/lib/connect-pricing";

// Ripplewatch Connect is the only plan: a flat platform fee plus usage from a
// prepaid balance. One plan, so it's a single wide panel (price and checkout on
// the left, what's included on the right) rather than one card in a card grid.
export function PricingCards() {
  return (
    <div className="mx-auto grid max-w-4xl overflow-hidden rounded-2xl border border-primary/40 bg-card shadow-md shadow-primary/10 md:grid-cols-5">
      <div className="flex flex-col gap-4 p-8 md:col-span-2 md:border-r md:border-border">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" />
          {CONNECT_NAME}
        </p>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-5xl font-semibold tracking-tight">${CONNECT_BASE_FEE_USD}</span>
            <span className="text-sm text-muted-foreground">/mo + usage</span>
          </div>
          <p className="mt-2 text-sm text-primary">
            Usage comes from a balance you prepay, from ${CONNECT_MIN_FUNDING_USD}.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">{CONNECT_TAGLINE}</p>
        <Link href="/onboarding?path=connect" className={buttonVariants({ size: "lg", className: "mt-2 w-full" })}>
          Get {CONNECT_NAME}
        </Link>
        <p className="text-xs leading-relaxed text-muted-foreground">
          First charge ${CONNECT_BASE_FEE_USD + CONNECT_DEFAULT_RELOAD_USD}: the ${CONNECT_BASE_FEE_USD} platform fee
          plus a ${CONNECT_DEFAULT_RELOAD_USD} starting balance, tax extra. Unused balance and the platform fee are
          refundable within 30 days. No seat fee.{" "}
          <Link href="/connect" className="underline underline-offset-2 hover:text-foreground">
            How it works
          </Link>
        </p>
      </div>
      <div className="bg-secondary/30 p-8 md:col-span-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What&apos;s included</p>
        <ul className="mt-4 space-y-3.5 text-sm">
          {CONNECT_PRICING_FEATURES.map((f) => (
            <FeatureRow key={f} label={f} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function FeatureRow({ label }: { label: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
      <span>{label}</span>
    </li>
  );
}
