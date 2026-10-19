import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CONNECT_PRICING_FEATURES, CONNECT_NAME, CONNECT_TAGLINE } from "@/lib/connect";
import { CONNECT_BASE_FEE_USD, CONNECT_MIN_FUNDING_USD } from "@/lib/connect-pricing";

// Ripplewatch Connect is the only product on sale: a flat platform fee plus
// usage from a prepaid balance.
export function PricingCards() {
  return (
    <div className="mx-auto max-w-md">
      <Card className="flex flex-col border-primary shadow-md shadow-primary/10">
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
            {CONNECT_PRICING_FEATURES.map((f) => (
              <FeatureRow key={f} label={f} />
            ))}
          </ul>
          <Link href="/onboarding?path=connect" className={buttonVariants({ className: "w-full" })}>
            Get {CONNECT_NAME}
          </Link>
          <p className="text-center text-xs text-muted-foreground">
            No seat fee. 30-day refund on the platform fee.{" "}
            <Link href="/connect" className="underline underline-offset-2 hover:text-foreground">
              How it works
            </Link>
          </p>
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
