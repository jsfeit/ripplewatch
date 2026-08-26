import Link from "next/link";
import { Waves } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const description =
  "Ripplewatch is built by Jeremy Feit, a product and growth operator who got tired of competitive intelligence tools that dump raw signals instead of judgment.";

export const metadata = {
  title: "About",
  description,
  alternates: { canonical: "/about" },
  openGraph: { title: "About | Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: "About | Ripplewatch", description, images: ["/opengraph-image"] },
};

// Person schema alongside the page's own bio content — a named, verifiable
// author is a real E-E-A-T/AEO signal (who is actually behind this claim),
// not decorative; sameAs points at the one public profile that backs it up.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Jeremy Feit",
  jobTitle: "Founder",
  worksFor: { "@type": "Organization", name: "Ripplewatch" },
  url: "https://www.ripplewatch.ai/about",
  sameAs: ["https://www.linkedin.com/in/jeremy-feit/"],
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />

      <h1 className="text-3xl font-semibold tracking-tight">About</h1>

      <div className="mt-8 flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Waves className="size-6" />
        </span>
        <div>
          <p className="font-medium">Jeremy Feit</p>
          <p className="text-sm text-muted-foreground">Founder, Ripplewatch</p>
        </div>
      </div>

      <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-foreground">
        <p>
          I built Ripplewatch because every competitive intelligence tool I&apos;d used across three
          startups did the same thing: dump every pricing change, job posting, and press mention
          into a feed and leave it to me to figure out which ones actually mattered. Most didn&apos;t.
          The few that did were buried in noise, usually found too late to act on.
        </p>
        <p>
          That problem got sharper every time I moved into a bigger, faster-moving business. I spent
          four years running growth and analytics at Home Chef through its climb from $9M to $425M
          in revenue and its $700M acquisition by Kroger, then five years as the first business hire
          at Backer, building the company&apos;s strategy and operations from zero to a $3M+, multi-channel
          business alongside the founders. Today I lead international growth at Intuit. In every one
          of those roles, competitive intelligence was either a spreadsheet someone updated
          sporadically, or a monitoring tool that generated alerts nobody trusted enough to act on.
        </p>
        <p>
          Ripplewatch is my attempt to fix that: score every competitor signal against your own
          positioning, ICP, and real lost-deal and churn reasons, so what shows up in your inbox or
          Slack is a verdict you can act on, not another raw feed to triage yourself.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <a
          href="https://www.linkedin.com/in/jeremy-feit/"
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline" })}
        >
          Connect on LinkedIn
        </a>
        <Link href="/onboarding" className={buttonVariants({})}>
          Try Ripplewatch
        </Link>
      </div>
    </div>
  );
}
