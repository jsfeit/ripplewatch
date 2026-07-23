import { Radar, Sparkles, Send, X, Check } from "lucide-react";
import { AlertCard } from "@/components/app/alert-card";
import { MOCK_SIGNALS, MOCK_COMPETITORS } from "@/lib/mock-data";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

export const metadata = { title: "How it works — Ripplewatch" };

const scoredExample = MOCK_SIGNALS.find((s) => s.id === "sig-2")!;
const rawExample = MOCK_SIGNALS.find((s) => s.id === "sig-8")!;
const competitorFor = (id: string) => MOCK_COMPETITORS.find((c) => c.id === id)!;

const STAGES = [
  {
    icon: Radar,
    title: "1. You give us context, not just competitor names",
    body: "Most tools ask 'who are your competitors?' and stop there. We ask about your positioning, your ICP, and — critically — the actual reasons deals were lost or customers churned. That context is what turns a raw signal into a judgment call.",
  },
  {
    icon: Sparkles,
    title: "2. Every signal gets scored against that context",
    body: "A pricing change, a job posting, a bad review — none of it means anything in isolation. We check it against your context profile and produce a relevance verdict: High, Medium, or Low, with the reasoning spelled out.",
  },
  {
    icon: Send,
    title: "3. You get a verdict, not a firehose",
    body: "Scored alerts show up in Slack and email with the reasoning attached, so your team can act in seconds instead of debating whether a signal is worth a Slack thread.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">
          Every competitor tool tells you what changed.
          <br />
          We tell you whether it matters to you — and why.
        </h1>
        <p className="mt-4 text-muted-foreground">
          The difference isn&apos;t more data. It&apos;s a verdict you can act on.
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
            Same category of signal — but scored against your ICP and known differentiators, with reasoning attached.
          </p>
        </div>
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
