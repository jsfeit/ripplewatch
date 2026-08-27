import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { COMPARISONS, getComparison } from "@/lib/comparisons";
import { QuizCta } from "@/components/marketing/quiz-cta";

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

  const title = `${entry.name} Alternative`;
  const description = `Considering a ${entry.name} alternative? Here's how Ripplewatch compares: ${entry.tagline}`;

  return {
    title,
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

  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          {entry.name} alternative
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance">
          Looking for a {entry.name} alternative?
        </h1>
        <p className="mt-4 text-muted-foreground">{entry.tagline}</p>
      </div>

      <div className="mt-16 space-y-10">
        <div>
          <h2 className="text-lg font-medium">What {entry.name} does well</h2>
          <p className="mt-2 leading-relaxed text-muted-foreground">{entry.whatTheyDoWell}</p>
        </div>
        <div>
          <h2 className="text-lg font-medium">Why teams look at Ripplewatch instead</h2>
          <p className="mt-2 leading-relaxed text-muted-foreground">{entry.differentiator}</p>
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

      <div className="mt-16 space-y-3 text-center">
        <Link href="/pricing" className={buttonVariants({ size: "lg" })}>
          Get started
          <ArrowRight className="size-4" />
        </Link>
        <QuizCta variant="inline" />
      </div>
    </div>
  );
}
