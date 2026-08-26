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
          Throughout my career, I&apos;ve always kept tabs on competitors. Changes in pricing, job
          postings, strategy, website copy, new product launches — whatever signals I could find.
          It&apos;s just something I&apos;ve done at every company, because it&apos;s genuinely useful.
        </p>
        <p>
          The problem was it was always ad-hoc. A spreadsheet here, a Slack reminder there, checking
          a pricing page every few weeks and hoping I didn&apos;t miss anything in between. But we
          missed things. A competitor would quietly change something important and I&apos;d find out
          weeks later, usually from someone else, and usually after they&apos;d taken advantage.
        </p>
        <p>
          It also ate way more time than it should have. Ad-hoc research is slow, and slow means
          you&apos;re reacting late instead of staying ahead.
        </p>
        <p>
          Ripplewatch is what I wished existed the whole time: an always-on version of what I was
          already trying to do manually, minus the gaps and the wasted hours.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <a
          href="https://www.linkedin.com/company/ripplewatch/"
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
