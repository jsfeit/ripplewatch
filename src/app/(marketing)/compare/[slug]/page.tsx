import type { Metadata } from "next";
import { fitTitle } from "@/lib/seo";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AlertCard } from "@/components/app/alert-card";
import { MOCK_SIGNALS, MOCK_COMPETITORS } from "@/lib/mock-data";
import { COMPARISONS, getComparison } from "@/lib/comparisons";
import { QuizCta } from "@/components/marketing/quiz-cta";
import { TIERS } from "@/lib/tiers";
import { CONNECT_BASE_FEE_USD, CONNECT_MIN_FUNDING_USD } from "@/lib/connect-pricing";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const scoredExample = MOCK_SIGNALS.find((s) => s.id === "sig-1")!;
const rawExample = MOCK_SIGNALS.find((s) => s.id === "sig-4")!;
const competitorFor = (id: string) => MOCK_COMPETITORS.find((c) => c.id === id)!;

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = getComparison(slug);
  if (!entry) return {};

  // The /alternatives page owns "X alternative"; this one is for the head-to-head searches.
  const title = `Ripplewatch vs. ${entry.name}: how they compare`;
  const description = `Ripplewatch vs. ${entry.name} side by side: how each monitors competitors, how findings are prioritized, who each is best for, and cost ($${CONNECT_BASE_FEE_USD}/month plus usage for Ripplewatch).`;

  return {
    title: fitTitle(title),
    description,
    alternates: { canonical: `/compare/${entry.slug}` },
    openGraph: { title: `${title} | Ripplewatch`, description },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Ripplewatch`,
      description,
    },
  };
}

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getComparison(slug);
  if (!entry) notFound();

  const faqs = [
    {
      q: `Is Ripplewatch a replacement for ${entry.name}?`,
      a: `It depends on the job. ${entry.name} is best for: ${entry.bestFor.charAt(0).toLowerCase()}${entry.bestFor.slice(1)}. Ripplewatch is built for small teams who want every competitor change scored against their own positioning and win/loss history, and who want to ask about it from inside Claude or ChatGPT.`,
    },
    {
      q: `How much does Ripplewatch cost compared with ${entry.name}?`,
      a: `Ripplewatch publishes its price: $${CONNECT_BASE_FEE_USD} per month plus a prepaid balance (from $${CONNECT_MIN_FUNDING_USD}) that pays for usage, with unused balance refundable. For ${entry.name}'s current pricing, check ${entry.domain}.`,
    },
    {
      q: `Can I see Ripplewatch work on ${entry.name} before signing up?`,
      a: `Yes. The free competitor snapshot reads ${entry.domain}'s pricing page, job board and recent news with no account.`,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-6 py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Ripplewatch",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            description: `How Ripplewatch compares to ${entry.name}: ${entry.tagline}`,
            offers: TIERS.map((tier) => ({
              "@type": "Offer",
              name: tier.name,
              price: String(tier.monthlyUsd),
              priceCurrency: "USD",
              description: tier.tagline,
            })),
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: APP_URL },
              { "@type": "ListItem", position: 2, name: "Compare", item: `${APP_URL}/compare` },
              {
                "@type": "ListItem",
                position: 3,
                name: `Ripplewatch vs. ${entry.name}`,
                item: `${APP_URL}/compare/${entry.slug}`,
              },
            ],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          Ripplewatch vs. {entry.name}
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance">
          {entry.name} tells you what changed.
          <br />
          <span className="text-primary">We tell you if {entry.name} is becoming a real threat.</span>
        </h1>
        <p className="mt-4 text-muted-foreground">{entry.tagline}</p>
      </div>

      <div className="mt-16 grid gap-8 rounded-2xl border border-border bg-secondary/30 p-8 sm:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <X className="size-4" />
            A raw signal, no context
          </div>
          <AlertCard
            signal={rawExample}
            competitorName={competitorFor(rawExample.competitorId).name}
            competitorInitial={competitorFor(rawExample.competitorId).initial}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            A fact, dropped in front of you, with no read on whether it&apos;s worth acting on.
          </p>
        </div>
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <Check className="size-4" />
            Ripplewatch
          </div>
          <AlertCard
            signal={scoredExample}
            competitorName={competitorFor(scoredExample.competitorId).name}
            competitorInitial={competitorFor(scoredExample.competitorId).initial}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Scored against your own positioning, ICP, and known lost-deal reasons, with the reasoning
            attached.
          </p>
        </div>
      </div>

      <div className="mt-16">
        <h2 className="text-lg font-medium">Ripplewatch vs. {entry.name} at a glance</h2>
        <p className="mt-1 text-xs text-muted-foreground sm:hidden">Swipe to see the full table →</p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30 text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">&nbsp;</th>
                <th className="px-4 py-3 font-medium text-primary">Ripplewatch</th>
                <th className="px-4 py-3 font-medium text-foreground">{entry.name}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="px-4 py-3 font-medium text-muted-foreground">Monitoring approach</td>
                <td className="px-4 py-3 text-foreground">Continuous tracking of your focused competitor list</td>
                <td className="px-4 py-3 text-muted-foreground">{entry.theirMechanism}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-4 py-3 font-medium text-muted-foreground">How findings are prioritized</td>
                <td className="px-4 py-3 text-foreground">
                  Scored against your positioning, ICP, and win/loss history
                </td>
                <td className="px-4 py-3 text-muted-foreground">{entry.howPrioritized}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-4 py-3 font-medium text-muted-foreground">Pricing</td>
                <td className="px-4 py-3 text-foreground">
                  ${CONNECT_BASE_FEE_USD}/month plus a prepaid balance from ${CONNECT_MIN_FUNDING_USD}, published
                </td>
                <td className="px-4 py-3 text-muted-foreground">See {entry.domain} for current pricing</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-muted-foreground">Best for</td>
                <td className="px-4 py-3 text-foreground">
                  Teams who want every finding scored against their own positioning
                </td>
                <td className="px-4 py-3 text-muted-foreground">{entry.bestFor}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-16 space-y-10">
        <div>
          <h2 className="text-lg font-medium">What {entry.name} does well</h2>
          <p className="mt-2 max-w-2xl leading-relaxed text-muted-foreground">{entry.whatTheyDoWell}</p>
        </div>
        <div>
          <h2 className="text-lg font-medium">
            Where Ripplewatch is different
          </h2>
          <p className="mt-2 max-w-2xl leading-relaxed text-muted-foreground">{entry.differentiator}</p>
        </div>
      </div>

      <div className="mt-16">
        <h2 className="text-lg font-medium">Common questions</h2>
        <dl className="mt-4 max-w-2xl space-y-5">
          {faqs.map((f) => (
            <div key={f.q}>
              <dt className="font-medium">{f.q}</dt>
              <dd className="mt-1 leading-relaxed text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-20 space-y-3 text-center">
        <Link href="/pricing" className={buttonVariants({ size: "lg" })}>
          Get started
          <ArrowRight className="size-4" />
        </Link>
        <QuizCta variant="inline" />
        <p className="text-sm text-muted-foreground">
          Weighing a switch?{" "}
          <Link href={`/alternatives/${entry.slug}`} className="text-primary hover:underline">
            See when to move from {entry.name} to Ripplewatch, and when not to
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
