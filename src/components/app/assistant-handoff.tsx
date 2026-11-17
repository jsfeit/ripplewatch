"use client";

import { forAssistant } from "@/lib/first-prompts";
import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { LINK_CLASS, openInChoices } from "@/components/app/first-questions";
import { trackEvent } from "@/lib/analytics";

export type Status = {
  churn: { months: number; headline: string | null; trend: "rising" | "falling" | "flat" | null };
  deals: { won: number; lost: number; churned: number; total: number };
};

const POLL_MS = 6000;
// Stops asking after this long on the screen, so a forgotten tab doesn't poll forever.
const GIVE_UP_MS = 15 * 60 * 1000;

// The setup step for bringing data in: hand it to the customer's own assistant, which can count rows,
// open Excel and pull from their billing tool or CRM, and then watch for it to arrive, the way the
// connect step watches for the connection. A collapsed fallback covers anyone whose plan can't save to
// Ripplewatch.
export function AssistantHandoff({
  kind,
  title,
  blurb,
  why,
  prompt,
  assistants,
  onArrived,
  onStatus,
  fallback,
}: {
  kind: "churn" | "deals";
  title: string;
  blurb: string;
  // What Ripplewatch does with it that a chat on its own can't: keep it, watch, and score.
  why: string;
  prompt: string;
  assistants?: string[];
  // Called when data of this kind has been saved, so the screen can update its progress.
  onArrived?: () => void;
  // Called with each fresh status, for anything else on the screen that depends on it.
  onStatus?: (status: Status) => void;
  fallback?: ReactNode;
}) {
  const open = openInChoices(assistants);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let stopped = false;
    const started = Date.now();
    async function check() {
      if (stopped || document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/connect/data-status");
        if (!res.ok) return;
        const data = (await res.json()) as Status;
        if (!stopped) setStatus(data);
      } catch {
        // Offline for a moment: the next check will catch up.
      }
    }
    void check();
    const timer = setInterval(() => {
      if (Date.now() - started > GIVE_UP_MS) {
        clearInterval(timer);
        return;
      }
      void check();
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (status) onStatus?.(status);
  }, [status, onStatus]);

  const arrived = status ? (kind === "churn" ? status.churn.months > 0 : status.deals.total > 0) : false;
  useEffect(() => {
    if (arrived) onArrived?.();
  }, [arrived, onArrived]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(forAssistant(prompt));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: the open-in links still work.
    }
  }

  let arrivedText = "";
  if (status && arrived) {
    if (kind === "churn") {
      const n = status.churn.months;
      arrivedText = `Got it. ${n} month${n === 1 ? "" : "s"} of churn. ${status.churn.headline ?? ""}`.trim();
    } else {
      const { won, lost, churned, total } = status.deals;
      const parts = [won > 0 ? `${won} won` : null, lost > 0 ? `${lost} lost` : null, churned > 0 ? `${churned} left` : null].filter(Boolean);
      arrivedText = `Got it. ${total} so far${parts.length > 0 ? `: ${parts.join(", ")}` : ""}.`;
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{blurb}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {open.claude ? (
            <a
              href={`https://claude.ai/new?q=${encodeURIComponent(forAssistant(prompt))}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent("setup_data_handoff_opened", { assistant: "claude", kind })}
              className={LINK_CLASS}
            >
              Open in Claude <ExternalLink className="size-3" />
            </a>
          ) : null}
          {open.chatgpt ? (
            <a
              href={`https://chatgpt.com/?q=${encodeURIComponent(forAssistant(prompt))}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent("setup_data_handoff_opened", { assistant: "chatgpt", kind })}
              className={LINK_CLASS}
            >
              Open in ChatGPT <ExternalLink className="size-3" />
            </a>
          ) : null}
          <button type="button" onClick={() => void copy()} className={LINK_CLASS}>
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? "Copied" : "Copy the prompt"}
          </button>
        </div>
        <p className="border-t border-border pt-3 text-xs text-muted-foreground">{why}</p>
        {arrived ? (
          <p className="flex items-start gap-1.5 text-sm text-primary" role="status">
            <Check className="mt-0.5 size-4 shrink-0" />
            <span>{arrivedText}</span>
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
            <Loader2 className="size-3 animate-spin" />
            Waiting for your data. This updates on its own. You can skip it and do it any time in Settings, under Data.
          </p>
        )}
      </div>

      {fallback ? (
        <details className="rounded-md border border-border p-3">
          <summary className="cursor-pointer select-none text-sm font-medium">Can&apos;t use your assistant right now? Type it here.</summary>
          <div className="mt-3">{fallback}</div>
        </details>
      ) : null}
    </div>
  );
}
