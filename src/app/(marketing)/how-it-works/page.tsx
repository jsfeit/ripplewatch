import { Radar, Sparkles, TrendingUp, Send, X, Check } from "lucide-react";
import { AlertCard } from "@/components/app/alert-card";
import { MOCK_SIGNALS, MOCK_COMPETITORS } from "@/lib/mock-data";
import { MOMENTUM_STYLES } from "@/lib/momentum";
import { buttonVariants } from "@/components/ui/button";
import { cn, avatarColor } from "@/lib/utils";
import Link from "next/link";

const description =
  "Not alerts. Not data. Answers. See exactly how a raw competitor signal turns into a Momentum score: scored against your positioning, ICP, and the real reasons deals were lost.";

export const metadata = {
  title: "How it works",
  description,
  alternates: { canonical: "/how-it-works" },
  openGraph: { title: "How it works | Ripplewatch", description },
  twitter: { card: "summary_large_image", title: "How it works | Ripplewatch", description },
};

const scoredExample = MOCK_SIGNALS.find((s) => s.id === "sig-2")!;
const rawExample = MOCK_SIGNALS.find((s) => s.id === "sig-8")!;
const competitorFor = (id: string) => MOCK_COMPETITORS.find((c) => c.id === id)!;

// Parano.ai's price cut (sig-1) is the same fictional scenario used on the
// homepage's Ask example — one consistent story running through the site's
// mock illustrations, instead of a different invented competitor per page.
const MOMENTUM_EXAMPLE = {
  competitorName: "Parano.ai",
  score: 42,
  label: "Heating up" as const,
  components: [
    { label: "Pricing activity", detail: "cut entry tier 30% this period" },
    { label: "Hiring", detail: "18 open roles vs 6 last period" },
    { label: "Press & funding", detail: "2 positive stories vs 0 last period" },
  ],
};

const STAGES = [
  {
    icon: Radar,
    title: "1. You give us context, not just competitor names",
    body: "Most tools ask 'who are your competitors?' and stop there. We ask about your positioning, your ICP, and, critically, the actual reasons deals were lost or customers churned. That context is what turns a raw signal into a judgment call.",
  },
  {
    icon: Sparkles,
    title: "2. Every signal gets scored against that context",
    body: "A pricing change, a job posting, a bad review: none of it means anything in isolation. We check it against your context profile and produce a relevance verdict: High, Medium, or Low, with the reasoning spelled out.",
  },
  {
    icon: TrendingUp,
    title: "3. It rolls up into one Momentum score",
    body: "Hiring, pricing activity, product changes, press and funding, review sentiment, and more, synthesized into a single Heating up, Steady, or Cooling read per competitor. You don't add up six trend lines yourself; we already did.",
  },
  {
    icon: Send,
    title: "4. You find out where it actually matters",
    body: "Scored updates show up in Slack and email with the reasoning attached, and every competitor's Momentum score updates on your dashboard in real time, so you can act in seconds instead of debating whether a signal is worth a Slack thread.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          Not alerts. Not data. Answers.
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance">
          From a raw signal to a Momentum score, in four steps.
        </h1>
        <p className="mt-4 text-muted-foreground">
          The difference isn&apos;t more data. It&apos;s knowing which competitors are actually
          becoming a threat.
        </p>
      </div>

      <div className="mt-16 grid gap-8 rounded-2xl border border-border bg-secondary/30 p-8 sm:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <X className="size-4" />
            Generic monitoring tool
          </div>
          <AlertCard
            signal={rawExample}
            competitorName={competitorFor(rawExample.competitorId).name}
            competitorInitial={competitorFor(rawExample.competitorId).initial}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            A raw fact, dropped in your inbox. No read on whether your team should care.
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
            Same category of signal, but scored against your ICP and known differentiators, with reasoning attached.
          </p>
        </div>
      </div>

      <div className="mt-10 rounded-2xl border border-primary/25 bg-primary/[0.04] p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Momentum</p>
        <h2 className="mt-1 text-lg font-medium">
          Every scored signal feeds one number per competitor
        </h2>
        <div className="mt-5 flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                avatarColor(MOMENTUM_EXAMPLE.competitorName)
              )}
            >
              {MOMENTUM_EXAMPLE.competitorName.charAt(0)}
            </span>
            <p className="font-semibold">{MOMENTUM_EXAMPLE.competitorName}</p>
          </div>
          <span
            className={cn(
              "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold",
              MOMENTUM_STYLES[MOMENTUM_EXAMPLE.label]
            )}
          >
            +{MOMENTUM_EXAMPLE.score} {MOMENTUM_EXAMPLE.label}
          </span>
        </div>
        <div className="mt-3 space-y-1.5 px-1 text-sm">
          {MOMENTUM_EXAMPLE.components.map((c) => (
            <div key={c.label} className="flex items-center justify-between text-muted-foreground">
              <span>{c.label}</span>
              <span className="tabular-nums">{c.detail}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Illustrative example. Real scores are computed from your account&apos;s own tracked signals.
        </p>
      </div>

      <div className="mt-20 space-y-10">
        {STAGES.map((stage) => (
          <div key={stage.title} className="flex gap-5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <stage.icon className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-medium">{stage.title}</h3>
              <p className="mt-2 max-w-2xl leading-relaxed text-muted-foreground">{stage.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-20 text-center">
        <Link href="/onboarding" className={buttonVariants({ size: "lg" })}>
          Try the live preview
        </Link>
      </div>
    </div>
  );
}
