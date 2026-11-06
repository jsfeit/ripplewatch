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
        `Using Ripplewatch: is ${c} heating up or cooling off, and what changed?`,
        `Using Ripplewatch: what's changed with ${c} this week, and should I worry?`,
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

// Which "Open in ..." links to offer. Only the assistants the person has actually connected: Claude,
// ChatGPT, or both. If a different assistant is connected (Cursor and the like) neither is offered and
// Copy is the way in; if nothing is recorded we can't tell, so both are shown.
function openInChoices(assistants: string[] | undefined): { claude: boolean; chatgpt: boolean } {
  const known = (assistants ?? []).filter((a) => a !== "unknown");
  if (known.length === 0) return { claude: true, chatgpt: true };
  return { claude: known.includes("claude"), chatgpt: known.includes("chatgpt") };
}

const LINK_CLASS =
  "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground";

// The one question to ask first, shown the moment the assistant connects:
// whether a competitor is heating up or cooling off, and what changed. It is
// the question that shows the Momentum score, which is what Ripplewatch does
// that a chat on its own can't.
export function FirstQuestionCard({ competitor, assistants }: { competitor: string | null; assistants?: string[] }) {
  const [copied, setCopied] = useState(false);
  const open = openInChoices(assistants);
  const q = firstQuestions(competitor)[0];

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
          check on {competitor?.trim() || "your competitors"} is running now, so the read gets richer over the next few
          minutes.
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
        <button type="button" onClick={() => void copy()} className={LINK_CLASS}>
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function FirstQuestions({ competitor, assistants }: { competitor: string | null; assistants?: string[] }) {
  const [copied, setCopied] = useState<number | null>(null);
  const open = openInChoices(assistants);
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

// Asked of the person's own assistant: read the deals (an attached export, or their CRM) and hand them to
// import_win_loss. Batches stay under what one call accepts (about 600 rows), rows go through verbatim so
// Ripplewatch can map any column layout itself, and the assistant reports what actually came in.
export const DEALS_PROMPT =
  "Using Ripplewatch: import my deal history. If I've attached a CSV or spreadsheet, read that. Otherwise pull my closed-won and closed-lost deals from my CRM, and ask me before you read anything. Send the rows to Ripplewatch with import_win_loss exactly as they appear, header row first, close dates included, in batches of about 500 rows, going back as far as the data goes. Then tell me how many deals came in.";

// The finish-screen step after the first question: put deal history in through the assistant they just
// connected. Same "Open in ..." rule as the first question; the settings upload stays as the fallback.
export function DealsImportCard({ assistants, settingsHref }: { assistants?: string[]; settingsHref: string }) {
  const [copied, setCopied] = useState(false);
  const open = openInChoices(assistants);

  async function copy() {
    try {
      await navigator.clipboard.writeText(DEALS_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: the open-in links still work.
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border p-5">
      <div>
        <p className="text-sm font-semibold">Bring in your deals</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Won and lost deals let every answer be checked against what actually happened. Open your assistant, attach a
          CSV or spreadsheet export (or let it read your CRM), and it sends them straight to Ripplewatch. Any column
          layout works, and the more history the better.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {open.claude ? (
          <a
            href={`https://claude.ai/new?q=${encodeURIComponent(DEALS_PROMPT)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("deals_import_opened", { assistant: "claude" })}
            className={LINK_CLASS}
          >
            Open in Claude <ExternalLink className="size-3" />
          </a>
        ) : null}
        {open.chatgpt ? (
          <a
            href={`https://chatgpt.com/?q=${encodeURIComponent(DEALS_PROMPT)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("deals_import_opened", { assistant: "chatgpt" })}
            className={LINK_CLASS}
          >
            Open in ChatGPT <ExternalLink className="size-3" />
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

// What to try first, one tab per thing Ripplewatch does. Shown the moment the assistant connects so the
// next move is obvious: pick what you want, open it in your assistant with the prompt already typed, or copy it.
// "Using Ripplewatch" leads each prompt so the assistant reaches for the tool instead of answering from memory.
export function firstPrompts(competitor: string | null): { id: string; label: string; blurb: string; prompt: string }[] {
  const c = competitor?.trim();
  return [
    {
      id: "heating",
      label: "Who's heating up",
      blurb: "A Momentum score, Heating up, Steady or Cooling, with the signals pulling it that way.",
      prompt: firstQuestions(competitor)[0],
    },
    {
      id: "briefing",
      label: "Weekly briefing",
      blurb: c ? `What changed across your competitors, starting with ${c}, and what to do about it.` : "What changed across your competitors and what to do about it.",
      prompt: "Using Ripplewatch: give me my competitive briefing for this week.",
    },
    {
      id: "deals",
      label: "What's costing us deals",
      blurb: "Ranked reasons you lose, checked against the deals you have told it about.",
      prompt: "Using Ripplewatch: what is costing us deals, and what should we do about it?",
    },
    {
      id: "log",
      label: "Log a deal",
      blurb: "Tell it how a deal went in plain words. It records it against the right competitor.",
      prompt:
        "Using Ripplewatch: log a deal for me. I'll tell you how it went: who it was against, whether we won or lost, and why. Ask me for anything that's missing.",
    },
    {
      id: "import",
      label: "Import deals",
      blurb: "Attach a CSV or let it read your CRM. Any column layout works.",
      prompt: DEALS_PROMPT,
    },
  ];
}

export function FirstPromptPicker({ competitor, assistants }: { competitor: string | null; assistants?: string[] }) {
  const prompts = firstPrompts(competitor);
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
          Your first check on {competitor?.trim() || "your competitors"} is running now, so the read gets richer over the
          next few minutes. Pick what you want to do and it opens in your assistant ready to send.
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
        <button type="button" onClick={() => void copy()} className={LINK_CLASS}>
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
