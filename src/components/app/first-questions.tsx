"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { ATTACH_PROMPT } from "@/lib/customer-metrics";
import { DEALS_PROMPT, firstPrompts, firstQuestions, nameList, type PromptContext } from "@/lib/first-prompts";
import type { Audience } from "@/lib/sales-motion";

// Questions worth asking first are written in lib/first-prompts.ts, for this company: its name, the
// competitors it named and whether it sells to businesses, consumers or both. Each opens Claude or ChatGPT
// with the question already typed in, with a copy button for any assistant (or for when the link doesn't
// prefill). "Using Ripplewatch" is in every one so the assistant reaches for the tool instead of answering
// from memory.

// What the person reads: the question without the "Using Ripplewatch:" the assistant gets.
function displayQuestion(q: string): string {
  const text = q.replace(/^Using Ripplewatch: /, "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export { openInChoices, cursorPromptUrl } from "@/lib/first-prompts";
import { openInChoices, cursorPromptUrl } from "@/lib/first-prompts";

export const LINK_CLASS =
  "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground";

// The one question to ask first, shown the moment the assistant connects:
// whether a competitor is heating up or cooling off, and what changed. It is
// the question that shows the Momentum score, which is what Ripplewatch does
// that a chat on its own can't.
export function FirstQuestionCard({ context, assistants }: { context: PromptContext; assistants?: string[] }) {
  const [copied, setCopied] = useState(false);
  const open = openInChoices(assistants);
  const q = firstQuestions(context)[0];

  async function copy() {
    try {
      await navigator.clipboard.writeText(q);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: the open-in links still work.
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/[0.06] p-5">
      <div>
        <p className="text-sm font-semibold text-primary">Ask your first question</p>
        <p className="mt-1 text-sm text-muted-foreground">
          You&apos;ll get a Momentum score, Heating up, Steady or Cooling, and the signals pulling it that way. Your first
          check on {nameList(context.competitors, 2) || "your competitors"} is running now, so the read gets richer over the next
          few minutes.
        </p>
      </div>
      <p className="rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium">{displayQuestion(q)}</p>
      <div className="flex flex-wrap gap-2">
        {open.claude ? (
          <a
            href={`https://claude.ai/new?q=${encodeURIComponent(q)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("first_question_opened", { assistant: "claude", index: 0, where: "connect" })}
            className={LINK_CLASS}
          >
            Open in Claude <ExternalLink className="size-3" />
          </a>
        ) : null}
        {open.chatgpt ? (
          <a
            href={`https://chatgpt.com/?q=${encodeURIComponent(q)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("first_question_opened", { assistant: "chatgpt", index: 0, where: "connect" })}
            className={LINK_CLASS}
          >
            Open in ChatGPT <ExternalLink className="size-3" />
          </a>
        ) : null}
        {open.cursor ? (
          <a
            href={cursorPromptUrl(q)}
            onClick={() => trackEvent("first_question_opened", { assistant: "cursor", index: 0, where: "connect" })}
            className={LINK_CLASS}
          >
            Open in Cursor <ExternalLink className="size-3" />
          </a>
        ) : null}
        <button type="button" onClick={() => void copy()} className={LINK_CLASS}>
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function FirstQuestions({ context, assistants }: { context: PromptContext; assistants?: string[] }) {
  const [copied, setCopied] = useState<number | null>(null);
  const open = openInChoices(assistants);
  const questions = firstQuestions(context);

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
              {open.claude ? (
                <a
                  href={`https://claude.ai/new?q=${encodeURIComponent(q)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvent("first_question_opened", { assistant: "claude", index: i })}
                  className={linkClass}
                >
                  Open in Claude <ExternalLink className="size-3" />
                </a>
              ) : null}
              {open.chatgpt ? (
                <a
                  href={`https://chatgpt.com/?q=${encodeURIComponent(q)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvent("first_question_opened", { assistant: "chatgpt", index: i })}
                  className={linkClass}
                >
                  Open in ChatGPT <ExternalLink className="size-3" />
                </a>
              ) : null}
              {open.cursor ? (
                <a
                  href={cursorPromptUrl(q)}
                  onClick={() => trackEvent("first_question_opened", { assistant: "cursor", index: i })}
                  className={linkClass}
                >
                  Open in Cursor <ExternalLink className="size-3" />
                </a>
              ) : null}
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

// The finish-screen step after the first question: put the company's data in through the assistant they just
// connected, written for how they sell. A B2B team is asked for deals, a consumer company for churn, and a
// company that sells to both gets one card for each. Same "Open in ..." rule as the first question; the
// settings upload stays as the fallback.
function ImportCard({
  title,
  body,
  prompt,
  event,
  assistants,
  settingsHref,
}: {
  title: string;
  body: string;
  prompt: string;
  event: string;
  assistants?: string[];
  settingsHref: string;
}) {
  const [copied, setCopied] = useState(false);
  const open = openInChoices(assistants);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: the open-in links still work.
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border p-5">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {open.claude ? (
          <a
            href={`https://claude.ai/new?q=${encodeURIComponent(prompt)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent(event, { assistant: "claude" })}
            className={LINK_CLASS}
          >
            Open in Claude <ExternalLink className="size-3" />
          </a>
        ) : null}
        {open.chatgpt ? (
          <a
            href={`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent(event, { assistant: "chatgpt" })}
            className={LINK_CLASS}
          >
            Open in ChatGPT <ExternalLink className="size-3" />
          </a>
        ) : null}
        {open.cursor ? (
          <a
            href={cursorPromptUrl(prompt)}
            onClick={() => trackEvent(event, { assistant: "cursor" })}
            className={LINK_CLASS}
          >
            Open in Cursor <ExternalLink className="size-3" />
          </a>
        ) : null}
        <button type="button" onClick={() => void copy()} className={LINK_CLASS}>
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <a href={settingsHref} className="ml-auto text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          Or upload a file here
        </a>
      </div>
    </div>
  );
}

export function DataImportCards({ assistants, settingsHref, sellsTo }: { assistants?: string[]; settingsHref: string; sellsTo: Audience | null }) {
  const deals = sellsTo !== "consumer";
  const churn = sellsTo === "consumer" || sellsTo === "both";
  return (
    <div className="space-y-4">
      {deals ? (
        <ImportCard
          title="Bring in your deals"
          body="Won and lost deals let every answer be checked against what actually happened. Open your assistant, attach a CSV or spreadsheet export (or let it read your CRM), and it sends them straight to Ripplewatch. Any column layout works, and the more history the better."
          prompt={DEALS_PROMPT}
          event="deals_import_opened"
          assistants={assistants}
          settingsHref={settingsHref}
        />
      ) : null}
      {churn ? (
        <ImportCard
          title="Bring in your churn"
          body="Your churn is how Ripplewatch can tell when customers start leaving, and whether a competitor moved around then. Open your assistant, attach an export (or let it read your billing tool), and it counts the rows and sends the months straight to Ripplewatch."
          prompt={ATTACH_PROMPT}
          event="churn_import_opened"
          assistants={assistants}
          settingsHref={settingsHref}
        />
      ) : null}
    </div>
  );
}

// What to try first, one tab per thing Ripplewatch does, written for this company (see lib/first-prompts.ts).
// Shown the moment the assistant connects so the next move is obvious: pick what you want, open it in your
// assistant with the prompt already typed, or copy it. "Using Ripplewatch" leads each prompt so the assistant
// reaches for the tool instead of answering from memory.
export function FirstPromptPicker({ context, assistants }: { context: PromptContext; assistants?: string[] }) {
  const prompts = firstPrompts(context);
  const [activeId, setActiveId] = useState(prompts[0].id);
  const [copied, setCopied] = useState(false);
  const open = openInChoices(assistants);
  const active = prompts.find((p) => p.id === activeId) ?? prompts[0];

  async function copy() {
    try {
      await navigator.clipboard.writeText(active.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: the open-in links still work.
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/[0.06] p-5">
      <div>
        <p className="text-sm font-semibold text-primary">You&apos;re connected. Try one of these first</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your first check on {nameList(context.competitors, 2) || "your competitors"} is running now, so the read gets richer
          over the next few minutes. Pick what you want to do and it opens in your assistant ready to send.
        </p>
      </div>
      <div role="tablist" aria-label="First things to try" className="flex flex-wrap gap-2">
        {prompts.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === activeId}
            onClick={() => {
              setActiveId(p.id);
              setCopied(false);
            }}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              p.id === activeId
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="space-y-2" role="tabpanel">
        <p className="text-xs text-muted-foreground">{active.blurb}</p>
        <p className="rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium">
          {displayQuestion(active.prompt)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {open.claude ? (
          <a
            href={`https://claude.ai/new?q=${encodeURIComponent(active.prompt)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("first_question_opened", { assistant: "claude", prompt: active.id, where: "connect" })}
            className={LINK_CLASS}
          >
            Open in Claude <ExternalLink className="size-3" />
          </a>
        ) : null}
        {open.chatgpt ? (
          <a
            href={`https://chatgpt.com/?q=${encodeURIComponent(active.prompt)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("first_question_opened", { assistant: "chatgpt", prompt: active.id, where: "connect" })}
            className={LINK_CLASS}
          >
            Open in ChatGPT <ExternalLink className="size-3" />
          </a>
        ) : null}
        {open.cursor ? (
          <a
            href={cursorPromptUrl(active.prompt)}
            onClick={() => trackEvent("first_question_opened", { assistant: "cursor", prompt: active.id, where: "connect" })}
            className={LINK_CLASS}
          >
            Open in Cursor <ExternalLink className="size-3" />
          </a>
        ) : null}
        <button type="button" onClick={() => void copy()} className={LINK_CLASS}>
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
