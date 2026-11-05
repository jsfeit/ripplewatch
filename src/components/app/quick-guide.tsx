"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

// Two screens, no more: where to use Ripplewatch, then what makes it sharper. Shown once on the finish
// screen after the first questions, so the person has just seen it work and now learns how to get more.
const SCREENS = [
  {
    title: "Ask in your assistant, not in a dashboard",
    lead: "Ripplewatch works inside Claude or ChatGPT. Start a question with “Using Ripplewatch:” and it reads your live competitor data instead of answering from memory.",
    points: [
      "Before a call: “Using Ripplewatch: what should I know about Acme before my demo tomorrow?”",
      "When something moves: “Using Ripplewatch: should we respond to their pricing change?”",
      "Every Monday: ask your assistant to run your competitor read on a schedule.",
    ],
    copy: null as string | null,
  },
  {
    title: "The more you tell it, the sharper it gets",
    lead: "Say it the way you'd tell a colleague. Ripplewatch keeps it, files it, and weighs every answer against it.",
    points: [
      "Deals you won and lost, with the reason and the date. This is the big one: it shows what's actually costing you.",
      "What customers say about competitors, from calls, tickets or Slack.",
      "What you're building and when it ships, plus any pricing change.",
    ],
    copy: "Using Ripplewatch: log a lost deal. We lost Northwind, about $48k, closed yesterday. They chose Acme because it connects to their data warehouse and we only offer a CSV export.",
  },
];

export function QuickGuide() {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const screen = SCREENS[index];
  const last = index === SCREENS.length - 1;

  if (done) return null;

  async function copy() {
    if (!screen.copy) return;
    try {
      await navigator.clipboard.writeText(screen.copy);
      setCopied(true);
      trackEvent("quick_guide_example_copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: the example is on screen to copy by hand.
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-5" role="region" aria-label="How to get the most from Ripplewatch">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Getting the most from it · {index + 1} of {SCREENS.length}
        </p>
        <button
          type="button"
          onClick={() => {
            trackEvent("quick_guide_dismissed", { at: index + 1 });
            setDone(true);
          }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Dismiss
        </button>
      </div>
      <div>
        <p className="text-sm font-semibold">{screen.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{screen.lead}</p>
      </div>
      <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground marker:text-primary">
        {screen.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      {screen.copy ? (
        <div className="rounded-lg bg-secondary/50 p-3">
          <p className="select-all text-sm leading-relaxed">{screen.copy}</p>
          <button
            type="button"
            onClick={() => void copy()}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? "Copied" : "Copy this example"}
          </button>
        </div>
      ) : null}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => setIndex(0)}
          disabled={index === 0}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:invisible"
        >
          <ArrowLeft className="size-3" /> Back
        </button>
        <button
          type="button"
          onClick={() => {
            if (last) {
              trackEvent("quick_guide_completed");
              setDone(true);
            } else setIndex(index + 1);
          }}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          {last ? "Got it" : "Next"} {last ? null : <ArrowRight className="size-3" />}
        </button>
      </div>
    </div>
  );
}
