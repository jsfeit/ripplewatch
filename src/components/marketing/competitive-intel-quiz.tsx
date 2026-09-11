"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
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
import { DemoLink } from "@/components/marketing/demo-link";
import { TIERS, tierForScore } from "@/lib/quiz-tiers";

type Question = { icon: LucideIcon; prompt: string; topic: string; options: string[] };

// Options are ordered low-maturity to high-maturity; the index doubles as
// its point value (0-3), so scoring is just summing selected indices.
// `topic` names the weak area in plain language when this question scores
// lowest, so the gated result can point at something specific ("your
// biggest gap is X") instead of only a generic tier.
const QUESTIONS: Question[] = [
  {
    icon: Radar,
    prompt: "How do you currently track competitor moves?",
    topic: "having any real tracking in place",
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
    topic: "how fast you find out",
    options: ["Weeks later, if at all", "A few days later", "Within a day", "Same day, automatically"],
  },
  {
    icon: Target,
    prompt: "How do you decide what's actually worth acting on?",
    topic: "deciding what's actually worth acting on",
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
    topic: "connecting competitor activity to deals you've actually lost",
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
    topic: "who actually owns this",
    options: [
      "No one; it's nobody's job",
      "Whoever notices, informally",
      "One person, part-time",
      "Sales, marketing, and product all get what's relevant to them",
    ],
  },
];

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

// Reads window.location directly rather than useSearchParams, same reasoning
// as settings-view.tsx's own ?tab= handling: a one-off query-param read on
// mount doesn't need a Suspense boundary. A shared link (?s=<score>) opens
// straight to a read-only view of that result for the person it was shared
// with — no email gate for them, since gating someone else's result behind
// their email would be a strange ask; the CTA there is to take their own.
const SHARE_PARAM = "s";

export function CompetitiveIntelQuiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(QUESTIONS.map(() => null));
  const [submitted, setSubmitted] = useState(false);
  const [sharedScore, setSharedScore] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [copied, setCopied] = useState(false);
  const [startTracked, setStartTracked] = useState(false);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get(SHARE_PARAM);
    const parsed = raw !== null ? Number(raw) : NaN;
    if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 15) {
      // Syncing one-time from an external system (the URL) on mount — the
      // case the rule's own guidance calls out as fine (same pattern as
      // settings-view.tsx's ?tab= handling).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSharedScore(parsed);
    }
  }, []);

  const score = useMemo(() => answers.reduce<number>((sum, a) => sum + (a ?? 0), 0), [answers]);
  const tier = useMemo(() => tierForScore(sharedScore ?? score), [sharedScore, score]);
  const TierIcon = tier.icon;

  // The lowest-scoring question — named in the gated result so it points at
  // something specific ("your biggest gap is X") instead of just a tier.
  // Ties (first one wins) are fine here: this is a conversational hook, not
  // a precise diagnostic.
  const weakestTopic = useMemo(() => {
    let weakestIndex = 0;
    let weakestValue = Infinity;
    answers.forEach((a, i) => {
      const value = a ?? 0;
      if (value < weakestValue) {
        weakestValue = value;
        weakestIndex = i;
      }
    });
    return QUESTIONS[weakestIndex].topic;
  }, [answers]);

  function selectAnswer(optionIndex: number) {
    if (!startTracked) {
      trackEvent("quiz_started");
      setStartTracked(true);
    }
    const updatedAnswers = answers.map((a, i) => (i === step ? optionIndex : a));
    setAnswers(updatedAnswers);
    if (step < QUESTIONS.length - 1) {
      // Small delay so the selected state is visible before advancing —
      // an instant jump reads as the click not having registered.
      setTimeout(() => setStep((s) => s + 1), 220);
    } else {
      setTimeout(() => {
        setSubmitted(true);
        // Computed from updatedAnswers, not the score memo — that memo
        // still reflects the pre-update answers array at this point in the
        // closure, since setAnswers above hasn't re-rendered yet.
        const finalScore = updatedAnswers.reduce<number>((sum, a) => sum + (a ?? 0), 0);
        // Fired on reaching the score screen, separate from generate_lead
        // on email submit — without this there was no way to tell "started
        // but never finished" apart from "finished but wouldn't give an
        // email," two very different drop-off problems.
        trackEvent("quiz_completed", { tier: tierForScore(finalScore).name, score: finalScore });
      }, 220);
    }
  }

  async function copyShareLink() {
    const url = `${window.location.origin}${window.location.pathname}?${SHARE_PARAM}=${score}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      trackEvent("share", { method: "quiz_link" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked (permissions, insecure context) —
      // nothing to fall back to here worth the complexity for a nice-to-have.
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
    setSharedScore(null);
    setStep(0);
    setAnswers(QUESTIONS.map(() => null));
    setReportStatus("idle");
    setEmail("");
    setStartTracked(false);
    window.history.replaceState(null, "", window.location.pathname);
  }

  // A shared link's viewer sees the score/tier free (no email gate — it's
  // not their result to unlock) with a CTA back to taking it themselves,
  // rather than the interactive quiz or the self-taker's email-gated flow.
  if (sharedScore !== null && !submitted) {
    return (
      <div className="space-y-6">
        <div className="animate-in fade-in zoom-in-95 flex flex-col items-center gap-4 rounded-2xl border border-primary/25 bg-card p-8 text-center duration-500">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Someone shared this result</p>
          <div className="relative flex items-center justify-center">
            <ScoreRing score={sharedScore} max={15} />
            <div className="absolute flex flex-col items-center">
              <TierIcon className="size-5 text-primary" />
              <span className="mt-1 text-xl font-semibold tracking-tight">{sharedScore}/15</span>
            </div>
          </div>
          <p className="text-2xl font-semibold tracking-tight">{tier.name}</p>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{tier.summary}</p>
        </div>
        <button
          type="button"
          onClick={retake}
          className={cn(buttonVariants(), "mx-auto flex w-fit")}
        >
          Take the quiz yourself
          <ArrowRight className="size-4" />
        </button>
      </div>
    );
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
          <button
            type="button"
            onClick={copyShareLink}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Copy className="size-3.5" />
            {copied ? "Link copied" : "Copy your result link"}
          </button>
        </div>

        {reportStatus === "done" ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-accent/40 p-6 text-center duration-300">
            <CheckCircle2 className="size-8 text-primary" />
            <p className="font-medium">
              Your biggest gap: {weakestTopic}
            </p>
            <ul className="w-full max-w-md space-y-2 text-left text-sm text-muted-foreground">
              {tier.nextSteps.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
              <Link href="/pricing" className={buttonVariants()}>
                Get started
                <ArrowRight className="size-4" />
              </Link>
              <DemoLink variant="button" />
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleGetReport}
            className="animate-in fade-in slide-in-from-bottom-2 space-y-3 rounded-2xl border border-border bg-card p-6 duration-300"
          >
            <Label htmlFor="quizEmail">Get your personalized next steps</Label>
            <p className="text-sm text-muted-foreground">
              Enter your email to see exactly what to do next for a {tier.name.toLowerCase()} team, including
              your single biggest gap.
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
                See my next steps
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
