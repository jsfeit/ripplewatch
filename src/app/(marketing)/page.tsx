import Link from "next/link";
import { ArrowRight, ArrowUp, Radar, Sparkles, Send, Waves, CircleDashed, Calendar } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { QuizCta } from "@/components/marketing/quiz-cta";
import { cn, avatarColor } from "@/lib/utils";

export const metadata = { alternates: { canonical: "/" } };

// Same underlying price-hike headline shown twice — once as a generic tool
// would surface it (raw, no context), once as Ripplewatch does (scored
// against deals lost/won and our own price point). Fictional competitor
// name deliberately: this is an illustrative example, not a factual claim
// about a real company's pricing.
//
// Bespoke markup (not the shared AlertCard component) on purpose: this
// layout — bold headline first, reasoning second, no upgrade nudge — is
// specific to this marketing example and shouldn't change how real scored/
// unscored signals render in the actual product.
const PRICE_HIKE_TITLE = "Northlane raised its Growth plan from $149 to $199/mo";

const DEMO_URL = "https://calendly.com/jeremyripplewatch/30min";

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
    "Two things worth acting on. They cut their entry tier from $99 to $69/mo, which directly narrows the price gap you've lost two deals to this month. They also removed the competitor-count cap on their top tier, which undercuts the \"scales with you\" pitch you lead with in upmarket conversations.",
};

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Ripplewatch",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "AI-native competitive intelligence for startup marketing teams. Scores every competitor signal against your own positioning, ICP, and lost-deal reasons: not just what changed, but whether it matters.",
  offers: [
    { "@type": "Offer", name: "Starter", price: "69", priceCurrency: "USD" },
    { "@type": "Offer", name: "Plus", price: "149", priceCurrency: "USD" },
    { "@type": "Offer", name: "Advanced", price: "349", priceCurrency: "USD" },
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
            <Link href="/pricing" className={buttonVariants({ size: "lg" })}>
              Get started
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/onboarding" className={buttonVariants({ size: "lg", variant: "outline" })}>
              See it in action
            </Link>
          </div>
          <a
            href={DEMO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <Calendar className="size-4" />
            Prefer to talk it through first? Book a demo
          </a>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Generic monitoring tool
              </p>
              <Panel radius="lg" className="relative mt-4 overflow-hidden p-4 pl-5">
                <div className="absolute inset-y-0 left-0 w-1 bg-border" />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        avatarColor("Northlane")
                      )}
                    >
                      N
                    </span>
                    <div>
                      <p className="text-sm font-medium leading-none">Northlane</p>
                      <p className="mt-1 text-xs text-muted-foreground">Pricing / site change</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                    <CircleDashed className="size-3" />
                    Raw signal
                  </Badge>
                </div>
                <p className="mt-3 text-sm font-medium">{PRICE_HIKE_TITLE}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Price change detected on their /pricing page. No further detail provided.
                </p>
              </Panel>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Ripplewatch
              </p>
              <div className="relative mt-4 overflow-hidden rounded-lg border border-primary/25 bg-card p-4 pl-5">
                <div className="absolute inset-y-0 left-0 w-1 bg-primary" />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Waves className="size-3.5" />
                    </span>
                    <div>
                      <p className="text-sm font-medium leading-none">Northlane</p>
                      <p className="mt-1 text-xs text-muted-foreground">Pricing / site change</p>
                    </div>
                  </div>
                  <Badge className="gap-1 border-primary/30 bg-primary/10 text-primary hover:bg-primary/10">
                    <Sparkles className="size-3" />
                    Scored
                  </Badge>
                </div>
                <div className="mt-3">
                  <span className="rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    High relevance
                  </span>
                </div>
                <p className="mt-2 text-[15px] font-semibold leading-relaxed text-foreground">
                  {PRICE_HIKE_TITLE}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground">
                  This closes the gap between Northlane and your Plus plan to just $25/mo. Northlane
                  came up as the price comparison in 20 of your last 100 lost deals. Worth revisiting
                  how you frame value at this price point, and reaching out to those lost deals given
                  this change.
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  All features within the Growth plan are the same, outside of the new AI chat feature
                  added across all SKUs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-semibold tracking-tight">How it works</h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <Panel key={step.title} className="relative p-6">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <step.icon className="size-5" />
              </div>
              <p className="mt-4 text-xs font-semibold text-muted-foreground">STEP {i + 1}</p>
              <h3 className="mt-1 text-lg font-medium">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </Panel>
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
              Ripplewatch isn&apos;t only a feed, it&apos;s an analyst you can question directly, scoped to
              your competitors, your positioning, and the last 90 days of signals.
            </p>
          </div>
          <Panel className="mx-auto mt-10 max-w-2xl p-5 shadow-sm">
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
          </Panel>
        </div>
      </section>

      <section className="border-t border-border px-6 py-20">
        <QuizCta />
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
            <PricingCards />
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
          Set up your account and start scoring competitive signals in minutes.
        </p>
        <div className="mt-8">
          <Link href="/pricing" className={buttonVariants({ size: "lg" })}>
            Get started
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
