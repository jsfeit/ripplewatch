import Link from "next/link";
import { ArrowRight, ArrowUp, Radar, Sparkles, Send } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { TierComparisonTable } from "@/components/marketing/tier-comparison-table";
import { AlertCard } from "@/components/app/alert-card";
import { MOCK_SIGNALS, MOCK_COMPETITORS } from "@/lib/mock-data";

export const metadata = { alternates: { canonical: "/" } };

const scoredExample = MOCK_SIGNALS.find((s) => s.id === "sig-1")!;
const rawExample = MOCK_SIGNALS.find((s) => s.id === "sig-4")!;
const competitorFor = (id: string) => MOCK_COMPETITORS.find((c) => c.id === id)!;

const STEPS = [
  {
    icon: Radar,
    title: "Connect your context",
    body: "Tell us your positioning, your ICP, and why deals don't close and customers churn, not simply who direct competitors are.",
  },
  {
    icon: Sparkles,
    title: "An analyst reads every signal",
    body: "News, pricing, job postings, funding, and sales-call mentions, checked against your context by an analyst that already knows your business, not a keyword scanner counting mentions.",
  },
  {
    icon: Send,
    title: "You get relevance-scored alerts",
    body: "Every signal is pushed to you with a verdict: does this matter to your business, and why, not simply what changed.",
  },
];

const ASK_EXCHANGE = {
  question: "What has Parano.ai changed recently that actually matters to us?",
  answer:
    "Two things worth acting on. They cut their entry tier from $99 to $69/mo — that directly narrows the price gap you've lost two deals to this month. They also removed the competitor-count cap on their top tier, which undercuts the \"scales with you\" pitch you lead with in upmarket conversations.",
};

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Ripplewatch",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "AI-native competitive intelligence for startup marketing teams. Scores every competitor signal against your own positioning, ICP, and lost-deal reasons — not just what changed, but whether it matters.",
  offers: [
    { "@type": "Offer", name: "Starter", price: "49", priceCurrency: "USD" },
    { "@type": "Offer", name: "Plus", price: "149", priceCurrency: "USD" },
    { "@type": "Offer", name: "Plus + Human", price: "499", priceCurrency: "USD" },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-20 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
            AI-native competitive intelligence for startup product and marketing teams
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Every tool tells you what changed.
            <br />
            <span className="text-primary">We tell you if it matters.</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground text-balance">
            Ripplewatch scores every competitor signal against your own positioning, ICP,
            lost-deal reasons, and churn. Your team stops drowning in alerts and starts acting
            on the few that actually move the needle.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/waitlist" className={buttonVariants({ size: "lg" })}>
              Join the waitlist
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/onboarding" className={buttonVariants({ size: "lg", variant: "outline" })}>
              See it in action
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Generic monitoring tool
              </p>
              <div className="mt-4">
                <AlertCard
                  signal={rawExample}
                  competitorName={competitorFor(rawExample.competitorId).name}
                  competitorInitial={competitorFor(rawExample.competitorId).initial}
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Ripplewatch
              </p>
              <div className="mt-4">
                <AlertCard
                  signal={scoredExample}
                  competitorName={competitorFor(scoredExample.competitorId).name}
                  competitorInitial={competitorFor(scoredExample.competitorId).initial}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-semibold tracking-tight">How it works</h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="relative rounded-xl border border-border bg-card p-6">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <step.icon className="size-5" />
              </div>
              <p className="mt-4 text-xs font-semibold text-muted-foreground">STEP {i + 1}</p>
              <h3 className="mt-1 text-lg font-medium">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/how-it-works" className={buttonVariants({ variant: "link" })}>
            See the full walkthrough <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <div className="mx-auto max-w-xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" />
              Ask
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">
              Don&apos;t wait for the alert. Just ask.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Ripplewatch isn&apos;t only a feed — it&apos;s an analyst you can question directly, scoped to
              your competitors, your positioning, and the last 90 days of signals.
            </p>
          </div>
          <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="ml-auto max-w-[85%] rounded-lg bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground">
              {ASK_EXCHANGE.question}
            </div>
            <div className="mr-auto mt-4 max-w-[85%] rounded-lg border border-primary/20 bg-accent/60 px-4 py-3 text-sm leading-relaxed text-foreground">
              {ASK_EXCHANGE.answer}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-4 py-2.5 text-sm text-muted-foreground">
              Ask about a competitor, a trend, or what&apos;s changed…
              <ArrowUp className="ml-auto size-3.5 shrink-0 rounded-full bg-primary p-0.5 text-primary-foreground" />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-center text-3xl font-semibold tracking-tight">
            Pick the tier that matches how you sell
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Every tier includes relevance context. Higher tiers unlock more competitors, more
            sources, and full scoring on every signal.
          </p>
          <div className="mt-10">
            <TierComparisonTable />
          </div>
          <div className="mt-8 text-center">
            <Link href="/pricing" className={buttonVariants()}>
              See full pricing details
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">Ready to stop guessing what matters?</h2>
        <p className="mt-3 text-muted-foreground">
          Join the waitlist — we&apos;re onboarding teams in small batches to keep relevance scoring sharp.
        </p>
        <div className="mt-8">
          <Link href="/waitlist" className={buttonVariants({ size: "lg" })}>
            Join the waitlist
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
