import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { CONNECT_NAME } from "@/lib/connect";
import { CONNECT_BASE_FEE_USD } from "@/lib/connect-pricing";

const description =
  "Ripplewatch is an AI competitive intelligence analyst in Claude and ChatGPT. $29 a month plus usage you prepay for, published up front.";

export const metadata = {
  title: "Pricing",
  description,
  alternates: { canonical: "/pricing" },
  openGraph: { title: "Pricing | Ripplewatch", description },
  twitter: { card: "summary_large_image", title: "Pricing | Ripplewatch", description },
};

// Derived from Connect's own constants (the same data PricingCards renders)
// rather than hardcoded a second time, so this can't silently drift from the
// real prices the way a copy-pasted schema block would.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Ripplewatch",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description,
  offers: [
    {
      "@type": "Offer",
      name: CONNECT_NAME,
      price: String(CONNECT_BASE_FEE_USD),
      priceCurrency: "USD",
      description: "Use Ripplewatch inside Claude or ChatGPT, plus usage you prepay for.",
    },
  ],
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Simple pricing</h1>
        <p className="mt-4 text-muted-foreground">
          No dedicated CI analyst to hire, Ripplewatch is the AI one. Connect it to Claude or ChatGPT and pay only
          for what you use.
        </p>
      </div>

      <div className="mt-14">
        <PricingCards />
      </div>

      <div className="mx-auto mt-16 flex max-w-2xl items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-6">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <p className="text-sm leading-relaxed text-foreground">
          <span className="font-semibold">30-day money-back guarantee.</span> Use {CONNECT_NAME} for real, against
          your real competitors. If it&apos;s not for you, email us within 30 days: the platform fee and any unused
          balance are refundable; usage you&apos;ve already spent isn&apos;t. Cancel anytime from Settings, no penalty
          or lock-in.
        </p>
      </div>

      <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-border bg-secondary/40 p-8 text-center">
        <h3 className="text-lg font-semibold">Want to see it work first?</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Run the free competitor snapshot to see what Ripplewatch reads about any competitor, no signup. When you
          want it inside Claude or ChatGPT, {CONNECT_NAME} takes a couple of minutes to connect.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/onboarding?path=connect" className={buttonVariants()}>
            Get a free competitor read
          </Link>
          <Link href="/competitor-snapshot" className={buttonVariants({ variant: "outline" })}>
            Try the free snapshot
          </Link>
        </div>
      </div>
    </div>
  );
}
