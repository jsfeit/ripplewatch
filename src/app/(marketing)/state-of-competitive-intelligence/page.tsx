import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  TOOL_PROFILES,
  LEADER_NOTES,
  LONG_TAIL_NOTE,
  COVERAGE_HEATMAP,
  type ToolProfile,
} from "@/lib/ci-market-research";

const description =
  "A survey of 20+ competitive intelligence tools — from enterprise research platforms to the new wave of AI-native, lean monitoring tools — and what's still missing from the category.";

export const metadata = {
  title: "The State of Competitive Intelligence Tools",
  description,
  alternates: { canonical: "/state-of-competitive-intelligence" },
  openGraph: {
    title: "The State of Competitive Intelligence Tools — Ripplewatch",
    description,
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "The State of Competitive Intelligence Tools — Ripplewatch",
    description,
    images: ["/opengraph-image"],
  },
};

function profilesFor(tier: ToolProfile["tier"]) {
  return TOOL_PROFILES.filter((p) => p.tier === tier);
}

function Cell({ on }: { on: boolean }) {
  return on ? (
    <Check className="mx-auto size-4 text-primary" />
  ) : (
    <span className="mx-auto block text-muted-foreground/40">—</span>
  );
}

export default function MarketResearchPage() {
  const midMarket = profilesFor("mid-market");
  const aiNative = profilesFor("ai-native");

  return (
    <div className="mx-auto max-w-4xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          Market research · July 2026
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance">
          The state of competitive intelligence tools
        </h1>
        <p className="mt-4 text-muted-foreground">{description}</p>
      </div>

      <section className="mt-20">
        <h2 className="text-2xl font-semibold tracking-tight">Three tiers of the market</h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
          Competitive intelligence tooling roughly splits into three tiers. At the top, enterprise
          research platforms like <strong className="text-foreground">AlphaSense</strong> and category
          leaders like <strong className="text-foreground">Crayon</strong> and{" "}
          <strong className="text-foreground">Klue</strong> serve larger sales and product-marketing
          orgs with analyst-grade research and battlecard workflows.{" "}
          {LEADER_NOTES.crayon} {LEADER_NOTES.klue} {LEADER_NOTES.alphaSense}
        </p>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          Below that sits a mid-market tier — tools like Kompyte, Contify, Similarweb, Owler, and
          LinkedIn Sales Navigator — priced for teams with a real budget but not enterprise scale.
          And below that, a crowded new wave of AI-native, lean tools has emerged in the last two
          years, most charging under $100/mo and leaning on AI generation instead of an analyst team.
        </p>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">Mid-market</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {midMarket.map((tool) => (
            <div key={tool.name} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-medium">{tool.name}</h3>
                <span className="text-xs text-muted-foreground">{tool.pricing}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tool.summary}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">AI-native and lean</h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
          The crowded new wave — nine tools built in the last two years, mostly solo or small-team
          products, mostly under $100/mo.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {aiNative.map((tool) => (
            <div key={tool.name} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-medium">{tool.name}</h3>
                <span className="text-xs text-muted-foreground">{tool.pricing}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tool.summary}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">{LONG_TAIL_NOTE}</p>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">The anatomy of a CI dashboard</h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
          Across all 20+ tools surveyed, four structural elements recur — almost every product is some
          arrangement of these.
        </p>
        <div className="mt-6 space-y-5">
          {[
            {
              title: "A per-competitor feed",
              body: "A list or set of cards, one per tracked competitor, as the primary navigation structure — nearly universal, from Crayon's Compete Hub to Owler's company profiles.",
            },
            {
              title: "A reverse-chronological change stream",
              body: "Signals ordered newest-first: pricing changes, launches, hiring spikes. The raw material every tool starts from, whether shown continuously or bundled into a digest.",
            },
            {
              title: "A \"why it matters\" layer (sometimes)",
              body: "Present in Crayon's Sparks, Caelian's priority scoring, Outmano's per-angle AI summaries. Absent in pure data terminals like Similarweb and Owler, which leave interpretation to the human reading it.",
            },
            {
              title: "A discrete output artifact",
              body: "Battlecards (Crayon, Klue, Kompyte), PDF reports (Compttr, Seeto), or a Monday email (Outmano). The dashboard itself is often just scaffolding toward this exportable end product.",
            },
          ].map((item, i) => (
            <div key={item.title} className="flex gap-4">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {i + 1}
              </div>
              <div>
                <h3 className="font-medium">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">Data coverage, at a glance</h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
          What each tool actually tracks, compiled from public pricing and product pages.
        </p>
        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left">
                <th className="sticky left-0 z-10 bg-secondary/40 p-3 font-medium">Tool</th>
                <th className="p-3 text-center font-medium">Pricing</th>
                <th className="p-3 text-center font-medium">Features</th>
                <th className="p-3 text-center font-medium">SEO/Traffic</th>
                <th className="p-3 text-center font-medium">Hiring</th>
                <th className="p-3 text-center font-medium">Reviews</th>
                <th className="p-3 text-center font-medium">Social</th>
                <th className="p-3 text-center font-medium">Funding/News</th>
                <th className="p-3 text-center font-medium">CRM/Deal</th>
              </tr>
            </thead>
            <tbody>
              {COVERAGE_HEATMAP.map((row, i) => (
                <tr
                  key={row.name}
                  className={cn("border-b border-border last:border-0", i % 2 === 1 && "bg-secondary/20")}
                >
                  <td
                    className={cn(
                      "sticky left-0 z-10 p-3 font-medium",
                      i % 2 === 1 ? "bg-secondary/20" : "bg-background"
                    )}
                  >
                    {row.name}
                  </td>
                  <td className="p-3"><Cell on={row.pricing} /></td>
                  <td className="p-3"><Cell on={row.features} /></td>
                  <td className="p-3"><Cell on={row.seoTraffic} /></td>
                  <td className="p-3"><Cell on={row.hiring} /></td>
                  <td className="p-3"><Cell on={row.reviews} /></td>
                  <td className="p-3"><Cell on={row.social} /></td>
                  <td className="p-3"><Cell on={row.fundingNews} /></td>
                  <td className="p-3"><Cell on={row.crmDealData} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-16 rounded-2xl border border-border bg-secondary/30 p-8">
        <h2 className="text-2xl font-semibold tracking-tight">What&apos;s still missing</h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
          Ripplewatch&apos;s core bet — score signals for relevance, not just severity — isn&apos;t entirely
          unprecedented. A few tools have started reaching for it:
        </p>
        <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
            <span>
              <strong className="text-foreground">Caelian&apos;s P0/P1/P2 framework</strong> — a generic
              severity scale, not tied to the reader&apos;s own business context.
            </span>
          </li>
          <li className="flex gap-2">
            <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
            <span>
              <strong className="text-foreground">RivalSense&apos;s downvote button</strong> — genuine
              feedback-loop personalization, but reactive: it learns what you don&apos;t want only after
              you&apos;ve told it, not upfront from your context.
            </span>
          </li>
          <li className="flex gap-2">
            <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
            <span>
              <strong className="text-foreground">Klue&apos;s Ask Klue</strong> — answers drawn strictly
              from validated internal data, a trust mechanism rather than a relevance-to-you mechanism.
            </span>
          </li>
          <li className="flex gap-2">
            <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
            <span>
              <strong className="text-foreground">Crayon&apos;s Sparks</strong> — importance-scoring that
              filters noise before it reaches the dashboard, but general-purpose rather than keyed to a
              specific customer&apos;s lost-deal history.
            </span>
          </li>
        </ul>
        <p className="mt-5 max-w-2xl leading-relaxed text-muted-foreground">
          None of these tie a signal&apos;s priority to the specific reasons a given company has actually
          lost deals or churned customers. That&apos;s the gap Ripplewatch is built around — an AI that reads
          every signal against your own positioning, ICP, and deal history, and tells you why it matters
          before you ever have to ask.
        </p>
        <div className="mt-6">
          <Link href="/waitlist" className={buttonVariants()}>
            Join the waitlist
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <p className="mt-16 text-center text-xs text-muted-foreground">
        Compiled from public pricing pages, product marketing, and review aggregators, July 2026.
        Corrections welcome at{" "}
        <a href="mailto:hello@ripplewatch.ai" className="text-primary hover:underline">
          hello@ripplewatch.ai
        </a>
        .
      </p>
    </div>
  );
}
