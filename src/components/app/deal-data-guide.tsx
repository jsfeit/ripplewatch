"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";

// Paste into Claude or ChatGPT (with a CRM connected) to get an export in the shape that works best.
const EXPORT_PROMPT =
  "Pull every closed-won and closed-lost deal from the last 24 months from my CRM, as one CSV with a header row. For each deal include: close date (YYYY-MM-DD), outcome (won or lost), amount, deal name, deal owner, the competitor if one is recorded, and the reason it was won or lost. If the reason field is empty, use the customer's own words from the deal notes. Don't summarize or rewrite anything.";

// Says what to upload and why, where the upload happens: which columns matter, why dates and history
// matter, and a prompt that has an assistant produce the export.
export function DealDataGuide() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(EXPORT_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the prompt is visible below to copy by hand.
    }
  }

  return (
    <div className="mt-3 rounded-md border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium"
      >
        What should I upload, and why does it matter?
        <ChevronDown className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="space-y-3 border-t border-border px-3 py-3 text-xs text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Every closed deal you can find, won and lost, as far back as you have.</p>
            <p className="mt-1">
              One row per deal, in any layout. You don&rsquo;t need to clean it up or rename columns: I work out which
              is which and show you before saving anything. Re-uploading deals you&rsquo;ve already added updates them
              rather than duplicating.
            </p>
          </div>

          <div>
            <p className="font-medium text-foreground">What each piece unlocks</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>
                <span className="text-foreground">Won or lost, plus a reason:</span> the minimum. The reason is what I
                read to find why you lose, even when you never learned who won.
              </li>
              <li>
                <span className="text-foreground">Close date:</span> turns a list into a timeline, so I can see whether
                losses cluster after a competitor changes pricing or ships something.
              </li>
              <li>
                <span className="text-foreground">Amount:</span> shows which reasons cost the most, not just which are
                most common.
              </li>
              <li>
                <span className="text-foreground">Competitor:</span> optional. Most lost deals never record it, and
                that&rsquo;s fine.
              </li>
            </ul>
          </div>

          <div>
            <p className="font-medium text-foreground">More is better</p>
            <p className="mt-1">
              About 15 deals across a couple of months starts to show patterns. 40 or more across six months or longer
              is enough to see trends and line them up with competitor moves. Older deals count, so go back 12 to 24
              months if you can.
            </p>
          </div>

          <div>
            <p className="font-medium text-foreground">Getting the export</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>
                <span className="text-foreground">HubSpot:</span> Deals, filter to closed won and closed lost, then
                Export. Include close date, deal stage, amount and closed lost reason.
              </li>
              <li>
                <span className="text-foreground">Salesforce:</span> a Reports export of closed Opportunities with
                close date, stage, amount and loss reason.
              </li>
              <li>
                <span className="text-foreground">Anything else:</span> a spreadsheet works. Or have your AI assistant
                pull it with the prompt below.
              </li>
            </ul>
          </div>

          <div className="rounded-md bg-secondary/50 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-foreground">Prompt for Claude or ChatGPT (with your CRM connected)</p>
              <button type="button" onClick={copy} className="inline-flex shrink-0 items-center gap-1 text-foreground hover:underline">
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-1.5 select-all leading-relaxed">{EXPORT_PROMPT}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
