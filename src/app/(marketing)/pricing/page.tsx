import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { CONNECT_NAME } from "@/lib/connect";
import { CONNECT_BASE_FEE_USD } from "@/lib/connect-pricing";

const description =
  "Competitor Momentum, watched every day and scored against your deals, in Claude and ChatGPT. $29 a month plus usage you prepay for, published up front.";

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
          No dedicated CI analyst to hire, Ripplewatch is the AI one. Connect it to Claude, ChatGPT or Cursor and pay only
          for what you use. Try it risk free: if it&apos;s not for you, you get your ${CONNECT_BASE_FEE_USD} back
          within 30 days.
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
          or lock-in. Wondering what you&apos;re trusting us with? Read how we handle{" "}
          <Link href="/security" className="font-medium text-primary hover:underline">
            security and your data
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
