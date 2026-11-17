import Link from "next/link";
import { ArrowRight, Brain, Eye, Gauge, Radar, Sparkles, Send, Waves, CircleDashed } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { QuickAnswers } from "@/components/marketing/quick-answers";
import { SourcesToChat } from "@/components/marketing/sources-to-chat";
import { WorksWithYourAI } from "@/components/marketing/works-with-your-ai";
import { ExampleChats } from "@/components/marketing/example-chats";
import { cn, avatarColor } from "@/lib/utils";
import { CONNECT_NAME } from "@/lib/connect";
import { CONNECT_BASE_FEE_USD, CONNECT_DEFAULT_RELOAD_USD } from "@/lib/connect-pricing";

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

// The three things a chat on its own can't do, in plain terms. Cadence matches the crawler: pricing
// pages and job boards are checked daily, the slower sources (news searches, reviews, buzz, ads) weekly.
const WHAT_KEEPS_RUNNING = [
  {
    icon: Brain,
    title: "It remembers",
    chat: "Starts fresh each time. Last month's pricing page isn't saved anywhere, so it can't say what changed.",
    ripplewatch:
      "Keeps what it saw each time it looked, plus your won and lost deals and your churn, so it can say what changed and tie it to what you lost.",
  },
  {
    icon: Eye,
    title: "It watches",
    chat: "Only looks when you ask, so a price cut on Tuesday waits until you think to check.",
    ripplewatch:
      "Checks pricing pages and job boards every day, and news, reviews, buzz and ads every week, then flags what's worth your attention.",
  },
  {
    icon: Gauge,
    title: "It scores",
    chat: "Gives you a summary that reads a little different every time you ask.",
    ripplewatch:
      "Turns up to ten inputs into one Momentum score per competitor, calculated the same way each time, so you can see who's heating up and who's cooling.",
  },
];

const STEPS = [
  {
    icon: Radar,
    title: "Tell your assistant about your business",
    body: "In Claude or ChatGPT, give it your positioning, who buys, and why deals are lost and customers leave. Say it in a sentence or attach a file.",
  },
  {
    icon: Sparkles,
    title: "Ripplewatch keeps watching",
    body: "It checks pricing pages and job boards every day, plus press, reviews and product changes, against what you told it. It keeps the history, so it knows what changed.",
  },
  {
    icon: Send,
    title: "Ask for the read",
    body: "Every competitor gets a Momentum score (Heating up, Steady or Cooling). Ask in Claude or ChatGPT, or get a Slack alert when something big moves.",
  },
];

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Ripplewatch",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Ripplewatch is the memory and the watcher your AI assistant doesn't have. It keeps your won and lost deals and your churn, checks competitors' pricing pages and job boards every day along with press, reviews and product changes, and gives each competitor a Momentum score (Heating up, Steady or Cooling) scored against your own data. It works inside Claude, ChatGPT and other AI assistants over MCP.",
  offers: [
    { "@type": "Offer", name: CONNECT_NAME, price: String(CONNECT_BASE_FEE_USD), priceCurrency: "USD" },
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
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" />
            Now inside Claude and ChatGPT
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Your assistant answers once.
            <br />
            <span className="text-primary">Ripplewatch watches every day.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground text-balance">
            It keeps your deals and your churn, checks every competitor&apos;s pricing, hiring, press and product
            changes against them, and gives each competitor a Momentum score: Heating up, Steady or Cooling. Ask in
            Claude or ChatGPT. Nothing new to log into.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/onboarding?path=connect" className={buttonVariants({ size: "lg" })}>
              Try it risk free
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/connect" className={buttonVariants({ size: "lg", variant: "outline" })}>
              See how it works
            </Link>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            {/* One string, so a line break can't swallow the space after a price. */}
            {`$${CONNECT_BASE_FEE_USD}/month plus a $${CONNECT_DEFAULT_RELOAD_USD} starting balance ($${CONNECT_BASE_FEE_USD + CONNECT_DEFAULT_RELOAD_USD} up front). If it's not for you, email us within 30 days and we'll refund the $${CONNECT_BASE_FEE_USD} and any balance you haven't used. Only usage you've already spent isn't refundable.`}{" "}
            <Link href="/pricing" className="font-medium text-primary hover:underline">
              See pricing
            </Link>
          </p>
        </div>
        <SourcesToChat />
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Illustrative example. Company names and scores are made up.
        </p>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-balance">A chat answers once. Here&apos;s what keeps running.</h2>
            <p className="mt-3 text-muted-foreground">
              Claude and ChatGPT are good at reading something once. They don&apos;t keep a history, and they don&apos;t
              look unless you ask. That&apos;s the part Ripplewatch does, inside the assistant you already use.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {WHAT_KEEPS_RUNNING.map((item) => (
              <Panel key={item.title} className="p-6">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="size-5" />
                </div>
                <h3 className="mt-4 text-lg font-medium">{item.title}</h3>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">A chat on its own</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.chat}</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-primary">With Ripplewatch</p>
                <p className="mt-1 text-sm leading-relaxed">{item.ripplewatch}</p>
              </Panel>
            ))}
          </div>
        </div>
      </section>

      <WorksWithYourAI />

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
              competitors, your positioning, and the last 90 days of signals. Pick the one that sounds like you.
            </p>
          </div>
          <ExampleChats />
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Illustrative example. Company names and numbers are made up.
          </p>
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
            One plan, one price
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            One flat platform fee, plus usage you prepay for. Pay only for what you use, never on credit.
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
          Connect Ripplewatch to Claude or ChatGPT and ask your first question. If it&apos;s not useful in the first
          30 days, you get your ${CONNECT_BASE_FEE_USD} back, plus any balance you haven&apos;t used.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/onboarding?path=connect" className={buttonVariants({ size: "lg" })}>
            Try it risk free
            <ArrowRight className="size-4" />
          </Link>
          <Link href="/pricing" className={buttonVariants({ size: "lg", variant: "outline" })}>
            See pricing
          </Link>
        </div>
      </section>
    </>
  );
}
