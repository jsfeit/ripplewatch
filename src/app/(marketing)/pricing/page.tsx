import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { TIERS } from "@/lib/tiers";

const description =
  "Relevance-scored competitive intelligence starting at $69/mo. Every tier includes AI-scored alerts against your own positioning and lost-deal reasons.";

export const metadata = {
  title: "Pricing",
  description,
  alternates: { canonical: "/pricing" },
  openGraph: { title: "Pricing | Ripplewatch", description },
  twitter: { card: "summary_large_image", title: "Pricing | Ripplewatch", description },
};

// Derived from TIERS (the same data PricingCards renders) rather than
// hardcoded a second time, so this can't silently drift from the real
// prices the way a copy-pasted schema block would the next time a price
// changes.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Ripplewatch",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description,
  offers: TIERS.map((tier) => ({
    "@type": "Offer",
    name: tier.name,
    price: String(tier.monthlyUsd),
    priceCurrency: "USD",
    description: tier.tagline,
  })),
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Pricing that scales with your team, not your headcount</h1>
        <p className="mt-4 text-muted-foreground">
          No dedicated CI analyst required. Pick self-serve or bring in ours.
        </p>
      </div>

      <div className="mt-14">
        <PricingCards />
      </div>

      <div className="mx-auto mt-16 flex max-w-2xl items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-6">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <p className="text-sm leading-relaxed text-foreground">
          <span className="font-semibold">30-day money-back guarantee, on every plan.</span>{" "}
          Use Ripplewatch for real, against your real competitors. If it&apos;s not for you, email us
          within 30 days of any charge for a full refund. Cancel anytime from Settings, no penalty
          or lock-in; it takes effect at the end of your current billing period.
        </p>
      </div>

      <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-border bg-secondary/40 p-8 text-center">
        <h3 className="text-lg font-semibold">Not sure which tier fits?</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Most self-serve teams start on Starter and move to Plus once relevance scoring proves
          its worth on their first few alerts.
        </p>
        <Link href="/onboarding?plan=starter&period=monthly" className={buttonVariants({ className: "mt-6" })}>
          Get started
        </Link>
      </div>
    </div>
  );
}
