import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AlertCard } from "@/components/app/alert-card";
import { MOCK_SIGNALS, MOCK_COMPETITORS } from "@/lib/mock-data";
import { COMPARISONS, getComparison } from "@/lib/comparisons";

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

  const title = `Ripplewatch vs. ${entry.name}`;
  const description = `How Ripplewatch compares to ${entry.name}: ${entry.tagline}`;

  return {
    title,
    description,
    alternates: { canonical: `/compare/${entry.slug}` },
    openGraph: { title: `${title} — Ripplewatch`, description, images: ["/opengraph-image"] },
    twitter: {
      card: "summary_large_image",
      title: `${title} — Ripplewatch`,
      description,
      images: ["/opengraph-image"],
    },
  };
}

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getComparison(slug);
  if (!entry) notFound();

  return (
    <div className="mx-auto max-w-4xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          Ripplewatch vs. {entry.name}
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance">
          {entry.name} tells you what changed.
          <br />
          <span className="text-primary">We tell you if it matters to you.</span>
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
            A fact, dropped in front of you — no read on whether it's worth acting on.
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
            Scored against your own positioning, ICP, and known lost-deal reasons — with the reasoning
            attached.
          </p>
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

      <div className="mt-20 text-center">
        <Link href="/waitlist" className={buttonVariants({ size: "lg" })}>
          Join the waitlist
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
