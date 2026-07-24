import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { TierComparisonTable } from "@/components/marketing/tier-comparison-table";
import { PricingCards } from "@/components/marketing/pricing-cards";

const description =
  "Relevance-scored competitive intelligence starting at $69/mo. Every tier includes AI-scored alerts against your own positioning and lost-deal reasons.";

export const metadata = {
  title: "Pricing",
  description,
  alternates: { canonical: "/pricing" },
  openGraph: { title: "Pricing — Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: "Pricing — Ripplewatch", description, images: ["/opengraph-image"] },
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Pricing that scales with your team, not your headcount</h1>
        <p className="mt-4 text-muted-foreground">
          No dedicated CI analyst required. Pick self-serve or bring in ours.
        </p>
      </div>

      <div className="mt-14">
        <PricingCards />
      </div>

      <div className="mt-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight">Full feature comparison</h2>
        <div className="mt-8">
          <TierComparisonTable />
        </div>
      </div>

      <div className="mx-auto mt-20 max-w-2xl rounded-xl border border-border bg-secondary/40 p-8 text-center">
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
