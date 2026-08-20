"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  Loader2,
  Radar,
  Rocket,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { UTM_STORAGE_KEY } from "@/components/utm-capture";

type Question = { icon: LucideIcon; prompt: string; options: string[] };

// Options are ordered low-maturity to high-maturity; the index doubles as
// its point value (0-3), so scoring is just summing selected indices.
const QUESTIONS: Question[] = [
  {
    icon: Radar,
    prompt: "How do you currently track competitor moves?",
    options: [
      "We don't, really; someone notices eventually",
      "Occasional manual searching or a Slack mention",
      "Google Alerts or an RSS/news feed",
      "A dedicated tool or process with clear ownership",
    ],
  },
  {
    icon: Rocket,
    prompt: "When a competitor changes pricing or launches a feature, how fast do you find out?",
    options: ["Weeks later, if at all", "A few days later", "Within a day", "Same day, automatically"],
  },
  {
    icon: Target,
    prompt: "How do you decide what's actually worth acting on?",
    options: [
      "We don't; everything feels urgent, or nothing does",
      "Gut feeling, or whoever's loudest about it",
      "A general priority framework (e.g. severity tiers)",
      "Scored against our own positioning and win/loss history",
    ],
  },
  {
    icon: Eye,
    prompt: "Do you know which competitor moves are actually costing you deals?",
    options: [
      "No idea",
      "Anecdotally, from a few conversations",
      "We track lost-deal reasons but don't connect them to competitor activity",
      "Yes, systematically tied together",
    ],
  },
  {
    icon: CheckCircle2,
    prompt: "Who acts on competitive intel today?",
    options: [
      "No one; it's nobody's job",
      "Whoever notices, informally",
      "One person, part-time",
      "Sales, marketing, and product all get what's relevant to them",
    ],
  },
];

type Tier = { name: string; icon: LucideIcon; range: [number, number]; summary: string; nextStep: string };

const TIERS: Tier[] = [
  {
    name: "Reactive",
    icon: Eye,
    range: [0, 4],
    summary: "You're finding out about competitor moves after they've already mattered, usually from a customer or a lost deal.",
    nextStep:
      "The fastest fix isn't a full program: pick 3-5 real competitors and get notified the moment their pricing, hiring, or product pages change. That alone closes most of the gap.",
  },
  {
    name: "Aware",
    icon: Radar,
    range: [5, 8],
    summary: "You've got some monitoring in place, but it's mostly noise: alerts with no read on which ones are actually worth acting on.",
    nextStep:
      "The next step is tying incoming signals to your own lost-deal and churn reasons, so a pricing change that's dangerous for you gets flagged differently than one that isn't.",
  },
  {
    name: "Systematic",
    icon: Target,
    range: [9, 12],
    summary: "You've built a real process, but it's still generic: the same priority framework applied to every signal, regardless of your specific business.",
    nextStep:
      "The gap between Systematic and Predictive is relevance scoring tied to your actual positioning and win/loss history, not a general severity scale everyone else uses too.",
  },
  {
    name: "Predictive",
    icon: Rocket,
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

// Radial score ring — plain SVG + one CSS transition, no charting lib. Starts
// fully "empty" and animates to the real score just after mount so the
// reveal feels like a result landing, not a static number.
function ScoreRing({ score, max }: { score: number; max: number }) {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const size = 128;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = score / max;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-border"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        className="text-primary transition-[stroke-dashoffset] duration-1000 ease-out"
        strokeDasharray={circumference}
        strokeDashoffset={filled ? circumference * (1 - fraction) : circumference}
      />
    </svg>
  );
}

export function CompetitiveIntelQuiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(QUESTIONS.map(() => null));
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const score = useMemo(() => answers.reduce<number>((sum, a) => sum + (a ?? 0), 0), [answers]);
  const tier = useMemo(() => tierForScore(score), [score]);
  const TierIcon = tier.icon;

  function selectAnswer(optionIndex: number) {
    setAnswers((prev) => prev.map((a, i) => (i === step ? optionIndex : a)));
    if (step < QUESTIONS.length - 1) {
      // Small delay so the selected state is visible before advancing —
      // an instant jump reads as the click not having registered.
      setTimeout(() => setStep((s) => s + 1), 220);
    } else {
      setTimeout(() => setSubmitted(true), 220);
    }
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

  function retake() {
    setSubmitted(false);
    setStep(0);
    setAnswers(QUESTIONS.map(() => null));
    setReportStatus("idle");
    setEmail("");
  }

  if (submitted) {
    return (
      <div className="space-y-6">
        <div className="animate-in fade-in zoom-in-95 flex flex-col items-center gap-4 rounded-2xl border border-primary/25 bg-card p-8 text-center duration-500">
          <div className="relative flex items-center justify-center">
            <ScoreRing score={score} max={15} />
            <div className="absolute flex flex-col items-center">
              <TierIcon className="size-5 text-primary" />
              <span className="mt-1 text-xl font-semibold tracking-tight">{score}/15</span>
            </div>
          </div>
          <p className="text-2xl font-semibold tracking-tight">{tier.name}</p>

          <div className="flex w-full max-w-sm items-center gap-1.5">
            {TIERS.map((t) => (
              <div
                key={t.name}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors duration-500",
                  t.range[0] <= tier.range[0] ? "bg-primary" : "bg-border"
                )}
              />
            ))}
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{tier.summary}</p>
        </div>

        {reportStatus === "done" ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-accent/40 p-6 text-center duration-300">
            <CheckCircle2 className="size-8 text-primary" />
            <p className="font-medium">Here&apos;s what to do next</p>
            <p className="max-w-md text-sm text-muted-foreground">{tier.nextStep}</p>
            <Link href="/pricing" className={cn(buttonVariants(), "mt-2")}>
              Get started
              <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleGetReport}
            className="animate-in fade-in slide-in-from-bottom-2 space-y-3 rounded-2xl border border-border bg-card p-6 duration-300"
          >
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
          onClick={retake}
          className="mx-auto block text-sm text-muted-foreground hover:text-foreground"
        >
          Retake the quiz
        </button>
      </div>
    );
  }

  const question = QUESTIONS[step];
  const QuestionIcon = question.icon;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {QUESTIONS.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300",
              i < step ? "bg-primary" : i === step ? "bg-primary/50" : "bg-border"
            )}
          />
        ))}
      </div>
      <p className="text-center text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Question {step + 1} of {QUESTIONS.length}
      </p>

      <div
        key={step}
        className="animate-in fade-in slide-in-from-bottom-3 rounded-2xl border border-border bg-card p-6 duration-300 sm:p-8"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
            <QuestionIcon className="size-5" />
          </span>
          <p className="font-medium">{question.prompt}</p>
        </div>
        <div className="mt-5 space-y-2">
          {question.options.map((option, oi) => (
            <button
              key={option}
              type="button"
              onClick={() => selectAnswer(oi)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left text-sm transition-all",
                answers[step] === oi
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/40 hover:bg-secondary/40 hover:-translate-y-px"
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  answers[step] === oi ? "border-primary bg-primary" : "border-border"
                )}
              >
                {answers[step] === oi ? <CheckCircle2 className="size-4 text-primary-foreground" /> : null}
              </span>
              <span>{option}</span>
            </button>
          ))}
        </div>
      </div>

      {step > 0 ? (
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
      ) : null}
    </div>
  );
}
