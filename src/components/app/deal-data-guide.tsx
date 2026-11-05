"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";

type Example = { title: string; note: string; prompt: string };

// Prompts people can paste, grouped by what they are trying to do: bring history in, teach it one deal or
// one fact at a time, and put it on a schedule. They name Ripplewatch and the tool so the assistant uses it.
const EXAMPLES: Example[] = [
  {
    title: "Import a file I attach",
    note: "Attach a CSV or spreadsheet export first. Any column layout works.",
    prompt:
      "Using Ripplewatch: import the deals in the file I attached. Send the rows to Ripplewatch with import_win_loss exactly as they appear, header row first, close dates included, in batches of about 500 rows. Then tell me how many came in and how many it already had.",
  },
  {
    title: "Pull the last two years from my CRM",
    note: "Needs your CRM connected to the assistant. It asks before it reads anything.",
    prompt:
      "Pull every closed-won and closed-lost deal from the last 24 months from my CRM, as one CSV with a header row. For each deal include: close date (YYYY-MM-DD), outcome (won or lost), amount, deal name, deal owner, the competitor if one is recorded, and the reason it was won or lost. If the reason field is empty, use the customer's own words from the deal notes. Don't summarize or rewrite anything. Then send it to Ripplewatch with import_win_loss in batches of about 500 rows.",
  },
  {
    title: "Log one deal as it happens",
    note: "The quickest way to keep it current. Say it the way you'd say it to a colleague.",
    prompt:
      "Using Ripplewatch: log a lost deal. We lost Northwind, about $48k, closed yesterday. They went with Acme because it plugs into their data warehouse and we only have a CSV export.",
  },
  {
    title: "Teach it who you sell to",
    note: "Everything Ripplewatch scores is judged against this. It replaces what was saved, so it checks with you first.",
    prompt:
      "Using Ripplewatch: update how we're positioned. We sell revenue analytics to mid-market B2B SaaS finance teams (50 to 500 employees), and we win on fast setup and a native Snowflake connection. Show me what you'd save before you save it.",
  },
  {
    title: "Add what customers say about competitors",
    note: "A call, a Slack message, an offhand comment. Paste it as it is.",
    prompt:
      "Using Ripplewatch: log this customer feedback. On today's renewal call, their VP said Acme quoted them 30% less and offered a free migration, and that they're 'seriously looking'. Add it to what you know about Acme.",
  },
  {
    title: "Keep it current every Friday",
    note: "Both Claude and ChatGPT can run a prompt on a schedule. Ask the assistant to set it up, then confirm the first run recorded deals.",
    prompt:
      "Every Friday at 9am, pull the deals from my CRM that closed won or closed lost in the last 7 days, with the reason for each, and send them to Ripplewatch with import_win_loss exactly as you read them. Reply with how many came in. If there were none, say so. Do this now once so we can check it works.",
  },
  {
    title: "Get a Monday read on what's costing deals",
    note: "Pairs with the Friday import: the deals go in, then Ripplewatch reads them.",
    prompt:
      "Every Monday at 8am, ask Ripplewatch what changed with my competitors this week and which recent losses cite price or a missing feature. Give me three bullets and one thing to do about it.",
  },
];

function ExampleBlock({ title, note, prompt }: Example) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the prompt is visible to copy by hand.
    }
  }

  return (
    <div className="rounded-md bg-secondary/50 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-foreground">{title}</p>
        <button type="button" onClick={copy} className="inline-flex shrink-0 items-center gap-1 text-foreground hover:underline">
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-0.5">{note}</p>
      <p className="mt-1.5 select-all leading-relaxed text-foreground/80">{prompt}</p>
    </div>
  );
}

// Says what to upload and why, where the upload happens: which columns matter, why dates and history
// matter, and a prompt that has an assistant produce the export.
export function DealDataGuide() {
  const [open, setOpen] = useState(false);
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

          <div>
            <p className="font-medium text-foreground">Examples to paste into Claude or ChatGPT</p>
            <p className="mt-1">Each one works once Ripplewatch is connected. Copy, edit the details, send.</p>
            <div className="mt-2 space-y-2">
              {EXAMPLES.map((ex) => (
                <ExampleBlock key={ex.title} title={ex.title} note={ex.note} prompt={ex.prompt} />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
