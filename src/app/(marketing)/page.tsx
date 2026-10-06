import Link from "next/link";
import { ArrowRight, ArrowUp, Radar, Sparkles, Send, Waves, CircleDashed } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { QuickAnswers } from "@/components/marketing/quick-answers";
import { cn, avatarColor } from "@/lib/utils";
import { CONNECT_NAME } from "@/lib/connect";
import { CONNECT_BASE_FEE_USD } from "@/lib/connect-pricing";
import { MONTHLY_PRICE_USD } from "@/lib/pricing";

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

const ASK_EXCHANGE = {
  question: "What has Northlane changed recently that actually matters to us?",
  answer:
    "Two things worth acting on. They cut their entry tier from $99 to $69/mo, which directly narrows the price gap you've lost two deals to this month. They also removed the competitor-count cap on their top tier, which undercuts the \"scales with you\" pitch you lead with in upmarket conversations.",
};

const STEPS = [
  {
    icon: Radar,
    title: "Connect your context",
    body: "In Claude or ChatGPT, tell it your positioning, your ICP, and why deals don't close and customers churn, not simply who direct competitors are.",
  },
  {
    icon: Sparkles,
    title: "An analyst reads every signal",
    body: "News, pricing, job postings, funding, and sales-call mentions, checked against your context by an analyst that already knows your business, not a keyword scanner counting mentions.",
  },
  {
    icon: Send,
    title: "You get the read, not a pile of alerts",
    body: "Every competitor gets a Momentum score (Heating up, Steady, or Cooling) built from hiring, pricing, press, and product activity. Just ask for it.",
  },
];

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Ripplewatch",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Not alerts. Not data. Answers. Ripplewatch is an AI competitive intelligence analyst that works inside Claude and other AI assistants over MCP. It tracks your competitors' pricing, hiring, press and product changes, scores each one against your positioning and win/loss history, and tells product marketing and revenue teams which competitors are becoming a real threat.",
  offers: [
    { "@type": "Offer", name: CONNECT_NAME, price: String(CONNECT_BASE_FEE_USD), priceCurrency: "USD" },
    { "@type": "Offer", name: "Ripplewatch Dashboard", price: String(MONTHLY_PRICE_USD.plus), priceCurrency: "USD" },
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" />
            Now inside Claude and ChatGPT
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Not alerts. Not data.
            <br />
            <span className="text-primary">Answers.</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground text-balance">
            Ripplewatch is the AI competitive intelligence analyst that&apos;s with you all the time, built right into
            Claude or ChatGPT. Ask what your competitors are doing and what it actually means for your deals; it
            reads their pricing, hiring, press, and product changes and scores it against your own positioning, ICP,
            and lost-deal reasons, no dashboard required.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/onboarding?path=connect" className={buttonVariants({ size: "lg" })}>
              Get {CONNECT_NAME}
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/connect" className={buttonVariants({ size: "lg", variant: "outline" })}>
              See how it works
            </Link>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            ${CONNECT_BASE_FEE_USD}/month plus usage you prepay for.{" "}
            <Link href="/pricing" className="font-medium text-primary hover:underline">
              Prefer a shared dashboard?
            </Link>
          </p>
        </div>
      </section>

      <QuickAnswers />

      <section className="border-t border-border">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <div className="mx-auto max-w-xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" />
              This is {CONNECT_NAME}
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">
              Don&apos;t wait for the next update. Just ask.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Once you connect Ripplewatch, this is the conversation, right inside Claude or ChatGPT: scoped to your
              competitors, your positioning, and the last 90 days of signals.
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
          <div className="mt-8 text-center">
            <Link href="/connect" className={buttonVariants()}>
              See how {CONNECT_NAME} works <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-center text-sm text-muted-foreground">
            The read is only as good as the analyst behind it. Here&apos;s the difference:
          </p>
          <div className="mt-8 grid gap-10 sm:grid-cols-2">
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
                  This closes the gap between Northlane and your plan to just $25/mo. Northlane came up as the price
                  comparison in 20 of your last 100 lost deals. Worth revisiting how you frame value at this price
                  point, and reaching out to those lost deals given this change.
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

      <section className="border-t border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-center text-3xl font-semibold tracking-tight">
            Two ways to use Ripplewatch
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            {CONNECT_NAME} is the most flexible way in: no dashboard, pay only for what you use. The Dashboard is one
            fixed price for a team that wants a shared view.
          </p>
          <div className="mt-10">
            <PricingCards />
          </div>
          <div className="mt-8 text-center">
            <Link href="/pricing" className={buttonVariants({ variant: "link" })}>
              See full pricing details <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">Ready to stop guessing what matters?</h2>
        <p className="mt-3 text-muted-foreground">
          Connect Ripplewatch to Claude or ChatGPT and ask your first question in minutes.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/onboarding?path=connect" className={buttonVariants({ size: "lg" })}>
            Get {CONNECT_NAME}
            <ArrowRight className="size-4" />
          </Link>
          <Link href="/pricing" className={buttonVariants({ size: "lg", variant: "outline" })}>
            See dashboard pricing
          </Link>
        </div>
      </section>
    </>
  );
}
