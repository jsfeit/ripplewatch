"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

// Questions worth asking first, written with the person's own competitor in
// them. Each opens Claude or ChatGPT with the question already typed in, with
// a copy button for any assistant (or for when the link doesn't prefill).
// "Using Ripplewatch" is in every one so the assistant reaches for the tool
// instead of answering from memory.
export function firstQuestions(competitor: string | null): string[] {
  const c = competitor?.trim();
  return c
    ? [
        `Using Ripplewatch: what's changed with ${c} this week, and should I worry?`,
        `Using Ripplewatch: is ${c} heating up or cooling off?`,
        `Using Ripplewatch: should we respond to ${c}'s pricing?`,
        "Using Ripplewatch: start here. What do you know about us so far, and what would make your answers sharper?",
      ]
    : [
        "Using Ripplewatch: what changed with my competitors this week?",
        "Using Ripplewatch: which competitor is heating up fastest?",
        "Using Ripplewatch: start here. What do you know about us so far, and what would make your answers sharper?",
      ];
}

// What the person reads: the question without the "Using Ripplewatch:" the assistant gets.
function displayQuestion(q: string): string {
  const text = q.replace(/^Using Ripplewatch: /, "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function FirstQuestions({ competitor }: { competitor: string | null }) {
  const [copied, setCopied] = useState<number | null>(null);
  const questions = firstQuestions(competitor);

  async function copy(q: string, i: number) {
    try {
      await navigator.clipboard.writeText(q);
      setCopied(i);
      setTimeout(() => setCopied((cur) => (cur === i ? null : cur)), 1800);
    } catch {
      // Clipboard blocked: the open-in links still work.
    }
  }

  const linkClass =
    "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground";

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Ask your first question</p>
        <p className="text-xs text-muted-foreground">
          Pick one, and it opens in your assistant ready to send. The first check on your competitors is running now, so
          answers get richer over the next few minutes.
        </p>
      </div>
      <ul className="space-y-2">
        {questions.map((q, i) => (
          <li key={q} className="rounded-lg border border-border bg-secondary/40 p-3">
            <p className="text-sm">{displayQuestion(q)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href={`https://claude.ai/new?q=${encodeURIComponent(q)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("first_question_opened", { assistant: "claude", index: i })}
                className={linkClass}
              >
                Open in Claude <ExternalLink className="size-3" />
              </a>
              <a
                href={`https://chatgpt.com/?q=${encodeURIComponent(q)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("first_question_opened", { assistant: "chatgpt", index: i })}
                className={linkClass}
              >
                Open in ChatGPT <ExternalLink className="size-3" />
              </a>
              <button type="button" onClick={() => void copy(q, i)} className={linkClass}>
                {copied === i ? <Check className="size-3" /> : <Copy className="size-3" />}
                {copied === i ? "Copied" : "Copy"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
