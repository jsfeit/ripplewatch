"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { UTM_STORAGE_KEY } from "@/components/utm-capture";

type Question = { prompt: string; options: string[] };

// Options are ordered low-maturity to high-maturity; the index doubles as
// its point value (0-3), so scoring is just summing selected indices.
const QUESTIONS: Question[] = [
  {
    prompt: "How do you currently track competitor moves?",
    options: [
      "We don't, really; someone notices eventually",
      "Occasional manual searching or a Slack mention",
      "Google Alerts or an RSS/news feed",
      "A dedicated tool or process with clear ownership",
    ],
  },
  {
    prompt: "When a competitor changes pricing or launches a feature, how fast do you find out?",
    options: ["Weeks later, if at all", "A few days later", "Within a day", "Same day, automatically"],
  },
  {
    prompt: "How do you decide what's actually worth acting on?",
    options: [
      "We don't; everything feels urgent, or nothing does",
      "Gut feeling, or whoever's loudest about it",
      "A general priority framework (e.g. severity tiers)",
      "Scored against our own positioning and win/loss history",
    ],
  },
  {
    prompt: "Do you know which competitor moves are actually costing you deals?",
    options: [
      "No idea",
      "Anecdotally, from a few conversations",
      "We track lost-deal reasons but don't connect them to competitor activity",
      "Yes, systematically tied together",
    ],
  },
  {
    prompt: "Who acts on competitive intel today?",
    options: [
      "No one; it's nobody's job",
      "Whoever notices, informally",
      "One person, part-time",
      "Sales, marketing, and product all get what's relevant to them",
    ],
  },
];

type Tier = { name: string; range: [number, number]; summary: string; nextStep: string };

const TIERS: Tier[] = [
  {
    name: "Reactive",
    range: [0, 4],
    summary: "You're finding out about competitor moves after they've already mattered, usually from a customer or a lost deal.",
    nextStep:
      "The fastest fix isn't a full program: pick 3-5 real competitors and get notified the moment their pricing, hiring, or product pages change. That alone closes most of the gap.",
  },
  {
    name: "Aware",
    range: [5, 8],
    summary: "You've got some monitoring in place, but it's mostly noise: alerts with no read on which ones are actually worth acting on.",
    nextStep:
      "The next step is tying incoming signals to your own lost-deal and churn reasons, so a pricing change that's dangerous for you gets flagged differently than one that isn't.",
  },
  {
    name: "Systematic",
    range: [9, 12],
    summary: "You've built a real process, but it's still generic: the same priority framework applied to every signal, regardless of your specific business.",
    nextStep:
      "The gap between Systematic and Predictive is relevance scoring tied to your actual positioning and win/loss history, not a general severity scale everyone else uses too.",
  },
  {
    name: "Predictive",
    range: [13, 15],
    summary: "You're already doing most of what separates teams that catch competitive threats early: scored, fast, and tied to real outcomes.",
    nextStep:
      "Worth checking whether it holds up as you add more competitors or more people need visibility; that's usually where manual systems start to crack.",
  },
];

function tierForScore(score: number): Tier {
  return TIERS.find((t) => score >= t.range[0] && score <= t.range[1]) ?? TIERS[0];
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CompetitiveIntelQuiz() {
  const [answers, setAnswers] = useState<(number | null)[]>(QUESTIONS.map(() => null));
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const allAnswered = answers.every((a) => a !== null);
  const score = useMemo(() => answers.reduce<number>((sum, a) => sum + (a ?? 0), 0), [answers]);
  const tier = useMemo(() => tierForScore(score), [score]);

  function selectAnswer(questionIndex: number, optionIndex: number) {
    setAnswers((prev) => prev.map((a, i) => (i === questionIndex ? optionIndex : a)));
  }

  async function handleGetReport(e: React.FormEvent) {
    e.preventDefault();
    setReportStatus("loading");

    let utm: Record<string, string> = {};
    try {
      const raw = localStorage.getItem(UTM_STORAGE_KEY);
      if (raw) utm = JSON.parse(raw);
    } catch {
      // ignore malformed/blocked storage
    }

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), capturePoint: "quiz", ...utm }),
      });
      if (!res.ok) {
        setReportStatus("error");
        return;
      }
      trackEvent("generate_lead", { method: "quiz" });
      setReportStatus("done");
    } catch {
      setReportStatus("error");
    }
  }

  if (submitted) {
    return (
      <div className="space-y-8">
        <div className="rounded-xl border border-primary/25 bg-card p-6 text-center">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">Your score</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">
            {score}/15 · {tier.name}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{tier.summary}</p>
        </div>

        {reportStatus === "done" ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-primary/30 bg-accent/40 p-6 text-center">
            <CheckCircle2 className="size-8 text-primary" />
            <p className="font-medium">Here&apos;s what to do next</p>
            <p className="max-w-md text-sm text-muted-foreground">{tier.nextStep}</p>
            <Link href="/pricing" className={cn(buttonVariants(), "mt-2")}>
              Get started
              <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleGetReport} className="space-y-3 rounded-xl border border-border bg-card p-6">
            <Label htmlFor="quizEmail">Get your personalized next step</Label>
            <p className="text-sm text-muted-foreground">
              Enter your email to see exactly what to do next for a {tier.name.toLowerCase()} team.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="quizEmail"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="sm:flex-1"
              />
              <Button type="submit" disabled={reportStatus === "loading" || !EMAIL_PATTERN.test(email.trim())}>
                {reportStatus === "loading" ? <Loader2 className="size-4 animate-spin" /> : null}
                See my next step
              </Button>
            </div>
            {reportStatus === "error" ? (
              <p className="text-sm text-destructive">Something went wrong. Try again.</p>
            ) : null}
          </form>
        )}

        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setAnswers(QUESTIONS.map(() => null));
            setReportStatus("idle");
            setEmail("");
          }}
          className="mx-auto block text-sm text-muted-foreground hover:text-foreground"
        >
          Retake the quiz
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {QUESTIONS.map((q, qi) => (
        <div key={q.prompt} className="rounded-xl border border-border bg-card p-6">
          <p className="font-medium">
            {qi + 1}. {q.prompt}
          </p>
          <div className="mt-4 space-y-2">
            {q.options.map((option, oi) => (
              <label
                key={option}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
                  answers[qi] === oi
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                )}
              >
                <input
                  type="radio"
                  name={`question-${qi}`}
                  className="mt-0.5"
                  checked={answers[qi] === oi}
                  onChange={() => selectAnswer(qi, oi)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <Button type="button" size="lg" disabled={!allAnswered} onClick={() => setSubmitted(true)} className="w-full">
        See my score
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}
