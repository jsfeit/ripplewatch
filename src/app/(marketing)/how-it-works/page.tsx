import { Radar, Sparkles, TrendingUp, Send, X, Check, Users, Wallet, Clock, Eye } from "lucide-react";
import { AlertCard } from "@/components/app/alert-card";
import { MOCK_SIGNALS, MOCK_COMPETITORS } from "@/lib/mock-data";
import { MOMENTUM_STYLES } from "@/lib/momentum";
import { buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { cn, avatarColor } from "@/lib/utils";
import Link from "next/link";

const description =
  "Not alerts. Not data. Answers. See exactly how a raw competitor signal turns into a Momentum score, scored against your positioning, ICP, and the real reasons deals were lost. No fractional hire, no one on your team distracted tracking this on the side.";

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

// Compttr, from MOCK_COMPETITORS (src/lib/mock-data.ts) — a fictional
// stand-in, kept distinct from RivalSense/SignalStack above so the same
// page doesn't show one invented competitor's name twice.
const MOMENTUM_EXAMPLE = {
  competitorName: "Compttr",
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
    accentText: "text-chart-1",
    accentBg: "bg-chart-1/10",
    title: "1. You give us context, not just competitor names",
    body: "Most tools ask “who are your competitors?” and stop there. In your onboarding you tell us your positioning, your ICP, and, critically, the actual reasons deals were lost or customers churned. Nobody has to carve time out of their real job to compile that; it's a 10-minute form.",
  },
  {
    icon: Sparkles,
    accentText: "text-chart-2",
    accentBg: "bg-chart-2/10",
    title: "2. Every signal gets scored against that context",
    body: "A pricing change, a job posting, a bad review: none of it means anything in isolation. We check it against your context profile and produce a relevance verdict, High, Medium, or Low, with the reasoning spelled out, so you're not the one deciding if it's worth a Slack message.",
  },
  {
    icon: TrendingUp,
    accentText: "text-chart-3",
    accentBg: "bg-chart-3/10",
    title: "3. It rolls up into one Momentum score",
    body: "Hiring, pricing activity, product changes, press and funding, review sentiment, and more, synthesized into a single Heating up, Steady, or Cooling read per competitor. You don't add up six trend lines between customer calls; we already did.",
  },
  {
    icon: Send,
    accentText: "text-chart-4",
    accentBg: "bg-chart-4/10",
    title: "4. You find out where it actually matters",
    body: "Scored updates show up in Slack and email with the reasoning attached, and every competitor's Momentum score updates on your dashboard in real time. Whoever used to half-own this as a side of their job gets to go back to their actual job.",
  },
];

const BUILT_FOR = [
  {
    icon: Users,
    title: "No fractional hire",
    body: "Most small teams bolt this onto part of someone's job, a founder, a marketer, a rep, checking competitor sites between everything else. Ripplewatch takes that slice off their plate.",
  },
  {
    icon: Wallet,
    title: "No analyst budget",
    body: "Enterprise CI platforms price for teams with a dedicated function. Ripplewatch is priced for a company where tracking competitors is nobody's full-time job.",
  },
  {
    icon: Clock,
    title: "No distractions",
    body: "No weekly competitive review to run or prep for. Scored updates land where you already work, when there's actually something worth acting on, not a recurring task on someone's list.",
  },
  {
    icon: Eye,
    title: "Nothing falls through the cracks",
    body: "Every tracked competitor gets checked every day, whether or not anyone remembered to look. No blind spot from a busy week or someone being on PTO.",
  },
];

// A compact line-art flow mark for the hero, in the same visual language as
// the blog's per-post covers (blog-visual.tsx): thin strokes, chart-color
// rotation, no photography/illustration standing in for it. Four nodes,
// left to right, mirroring the STAGES below, so the hero previews the page
// instead of decorating it.
function HeroFlowMark() {
  const nodes = [
    { x: 70, cls: "text-chart-1" },
    { x: 250, cls: "text-chart-2" },
    { x: 430, cls: "text-chart-3" },
    { x: 610, cls: "text-chart-4" },
  ];
  return (
    <svg viewBox="0 0 680 140" className="h-auto w-full max-w-2xl" aria-hidden="true">
      <line x1="70" y1="70" x2="610" y2="70" className="text-border" stroke="currentColor" strokeWidth="1.5" />
      {nodes.map((n, i) => (
        <g key={n.x}>
          <circle cx={n.x} cy="70" r={i === nodes.length - 1 ? "16" : "12"} className={n.cls} fill="currentColor" opacity={i === nodes.length - 1 ? "0.16" : "0.12"} />
          <circle cx={n.x} cy="70" r={i === nodes.length - 1 ? "5" : "4"} className={n.cls} fill="currentColor" />
          {i < nodes.length - 1 && (
            <circle cx={(n.x + nodes[i + 1].x) / 2} cy="70" r="2.5" className="text-border" fill="currentColor" />
          )}
        </g>
      ))}
    </svg>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          Built for small tech companies, not a fractional hire
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance">
          From a raw signal to a Momentum score, in four steps.
        </h1>
        <p className="mt-4 text-muted-foreground">
          No one on your team has to carve out part of their job to track competitors. Just the
          read on which ones are actually becoming a threat, delivered where you already work.
        </p>
      </div>

      <div className="mt-12 flex justify-center">
        <HeroFlowMark />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {BUILT_FOR.map((item) => (
          <Panel key={item.title} radius="lg" className="p-4">
            <div className="flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <item.icon className="size-3.5" />
              </span>
              <p className="text-sm font-semibold">{item.title}</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
          </Panel>
        ))}
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
        <div className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <TrendingUp className="size-3.5" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Momentum</p>
        </div>
        <h2 className="mt-2 text-lg font-medium">
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
            <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg", stage.accentBg, stage.accentText)}>
              <stage.icon className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-medium">{stage.title}</h3>
              <p className="mt-2 max-w-2xl leading-relaxed text-muted-foreground">{stage.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-16 max-w-2xl rounded-xl border border-border bg-secondary/40 p-6 text-center">
        <h3 className="text-lg font-semibold">Read it where you already work</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Everything above shows up in the dashboard, Slack and email. You can also connect Ripplewatch to Claude or
          ChatGPT and ask it directly, no dashboard needed.
        </p>
        <Link href="/connect" className={buttonVariants({ variant: "outline", className: "mt-4" })}>
          See Ripplewatch Connect
        </Link>
      </div>

      <div className="mt-20 text-center">
        <Link href="/onboarding" className={buttonVariants({ size: "lg" })}>
          Try the live preview
        </Link>
        <p className="mt-3 text-xs text-muted-foreground">No sales call, no one to hire or free up. Just your context.</p>
      </div>
    </div>
  );
}
