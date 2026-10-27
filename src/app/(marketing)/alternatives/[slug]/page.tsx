import type { Metadata } from "next";
import { fitTitle } from "@/lib/seo";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { COMPARISONS, getComparison } from "@/lib/comparisons";
import { QuizCta } from "@/components/marketing/quiz-cta";
import { TIERS } from "@/lib/tiers";
import { CONNECT_BASE_FEE_USD, CONNECT_MIN_FUNDING_USD } from "@/lib/connect-pricing";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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

  const title = `${entry.name} alternative: self-serve, from $${CONNECT_BASE_FEE_USD}/mo`;
  const description = `Looking for a ${entry.name} alternative? Ripplewatch works inside Claude and ChatGPT, scores every change against your positioning, and publishes its price: $${CONNECT_BASE_FEE_USD}/month plus usage. When to switch, and when not to.`;

  return {
    title: fitTitle(title),
    description,
    alternates: { canonical: `/alternatives/${entry.slug}` },
    openGraph: { title: `${title} | Ripplewatch`, description },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Ripplewatch`,
      description,
    },
  };
}

export default async function AlternativePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getComparison(slug);
  if (!entry) notFound();

  const faqs = [
    { q: `Why look for a ${entry.name} alternative?`, a: entry.switchGain },
    { q: `What does ${entry.name} do well?`, a: entry.whatTheyDoWell },
    {
      q: `Is Ripplewatch self-serve, and what does it cost?`,
      a: `Yes. There is no sales call. Pricing is published: a $${CONNECT_BASE_FEE_USD} per month platform fee plus a prepaid balance (from $${CONNECT_MIN_FUNDING_USD}) that pays for usage, and unused balance can be refunded.`,
    },
    { q: `When should I stay with ${entry.name}?`, a: entry.switchConsider },
  ];
  const related = COMPARISONS.filter((c) => c.slug !== entry.slug && ["kompyte", "crayon", "klue", "valona-intelligence"].includes(c.slug));

  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Ripplewatch",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            description: `Looking for a ${entry.name} alternative? Ripplewatch is an AI analyst that works inside Claude and other assistants over MCP, with pricing published up front.`,
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
              { "@type": "ListItem", position: 2, name: "Alternatives", item: `${APP_URL}/alternatives` },
              {
                "@type": "ListItem",
                position: 3,
                name: `${entry.name} Alternative`,
                item: `${APP_URL}/alternatives/${entry.slug}`,
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
          {entry.name} alternative
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance">
          Looking for a {entry.name} alternative?
        </h1>
        <p className="mt-4 text-muted-foreground">{entry.tagline}</p>
      </div>

      <div className="mt-12 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium"> </th>
              <th className="px-4 py-3 font-medium">Ripplewatch</th>
              <th className="px-4 py-3 font-medium">{entry.name}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border align-top">
            <tr>
              <th className="px-4 py-3 font-medium">Best for</th>
              <td className="px-4 py-3 text-muted-foreground">Small teams who want to see what changed at competitors and what to do about it, without an enterprise rollout</td>
              <td className="px-4 py-3 text-muted-foreground">{entry.bestFor}</td>
            </tr>
            <tr>
              <th className="px-4 py-3 font-medium">How changes are prioritized</th>
              <td className="px-4 py-3 text-muted-foreground">Scored against your positioning and your win/loss history</td>
              <td className="px-4 py-3 text-muted-foreground">{entry.howPrioritized}</td>
            </tr>
            <tr>
              <th className="px-4 py-3 font-medium">Where you use it</th>
              <td className="px-4 py-3 text-muted-foreground">Inside Claude, ChatGPT and other assistants over MCP, plus Slack</td>
              <td className="px-4 py-3 text-muted-foreground">Its own product</td>
            </tr>
            <tr>
              <th className="px-4 py-3 font-medium">Pricing</th>
              <td className="px-4 py-3 text-muted-foreground">${CONNECT_BASE_FEE_USD}/month plus a prepaid balance from ${CONNECT_MIN_FUNDING_USD}, published</td>
              <td className="px-4 py-3 text-muted-foreground">
                See <span className="font-medium">{entry.domain}</span> for current pricing
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-16 space-y-10">
        <div>
          <h2 className="text-lg font-medium">What you&apos;d gain by switching</h2>
          <p className="mt-2 leading-relaxed text-muted-foreground">{entry.switchGain}</p>
        </div>
        <div>
          <h2 className="text-lg font-medium">What to consider before switching</h2>
          <p className="mt-2 leading-relaxed text-muted-foreground">{entry.switchConsider}</p>
        </div>
        <div>
          <h2 className="text-lg font-medium">What to look for in a {entry.name} alternative</h2>
          <ul className="mt-3 space-y-3 text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-primary">·</span>
              <span>
                <span className="font-medium text-foreground">Relevance scoring tied to your business</span>,
                not a generic severity or priority scale that rates the same signal the same way for every
                company reading it.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">·</span>
              <span>
                <span className="font-medium text-foreground">Fast, self-serve setup</span>: you should be
                able to see it working on your own competitors before deciding whether to switch, not sit
                through a sales call first.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">·</span>
              <span>
                <span className="font-medium text-foreground">Transparent, published pricing</span> instead
                of a &quot;contact us&quot; page that hides what you&apos;ll actually pay.
              </span>
            </li>
          </ul>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Ripplewatch is built around all three: try it on your own competitors first, no account required
            until you decide it&apos;s worth it.
          </p>
        </div>
      </div>

      <div className="mt-16">
        <h2 className="text-lg font-medium">Questions about switching from {entry.name}</h2>
        <dl className="mt-4 space-y-5">
          {faqs.map((f) => (
            <div key={f.q}>
              <dt className="font-medium">{f.q}</dt>
              <dd className="mt-1 leading-relaxed text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-16 rounded-xl border border-dashed border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Want to see it work on {entry.name} itself, right now, no signup?{" "}
          <Link href="/competitor-snapshot" className="font-medium text-primary hover:underline">
            Run a free snapshot on {entry.domain}
          </Link>
          .
        </p>
      </div>

      <div className="mt-10 space-y-3 text-center">
        <Link href="/pricing" className={buttonVariants({ size: "lg" })}>
          Get started
          <ArrowRight className="size-4" />
        </Link>
        <QuizCta variant="inline" />
        <p className="text-sm text-muted-foreground">
          Prefer a feature-by-feature breakdown?{" "}
          <Link href={`/compare/${entry.slug}`} className="text-primary hover:underline">
            See Ripplewatch vs. {entry.name} in detail
          </Link>
          .
        </p>
        {related.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Also comparing:{" "}
            {related.map((c, i) => (
              <span key={c.slug}>
                {i > 0 ? ", " : ""}
                <Link href={`/alternatives/${c.slug}`} className="text-primary hover:underline">
                  {c.name}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </div>
  );
}
