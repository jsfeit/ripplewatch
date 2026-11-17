"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { AudiencePicker } from "@/components/app/audience-picker";
import { ChurnDataCard } from "@/components/app/churn-data-card";
import { CopyPromptButton } from "@/components/app/copy-prompt-button";
import { DealFileUpload } from "@/components/app/deal-file-upload";
import { dataCopy, type Audience } from "@/lib/sales-motion";
import { cn } from "@/lib/utils";

type Side = "business" | "consumer";

const PULL_DEALS_PROMPT =
  "Using Ripplewatch: take my closed-won and closed-lost deals from the file I've attached (or my CRM, last 24 months), with the reason for each. Show me what you read first, then add them to Ripplewatch with import_win_loss.";
// The typing box stops here; past it, a file upload or the assistant does better.
const TYPED_LIMIT = 2000;

// The body of the "bring your data" setup step, kept short because the whole step is optional. B2B
// gets one box for deals plus a file upload, B2C gets one box for churn, and a company that sells to
// both gets a tab for each. There is no list of tools to connect: those tools already work inside
// Claude and ChatGPT, so the step just says so and offers a prompt.
export function SetupDataStep({
  audience,
  onAudience,
  competitorNames,
  dealNote,
  onDealNote,
  onConsumerNote,
  onDealsUploaded,
  onMetricsSaved,
}: {
  audience: Audience | null;
  onAudience: (next: Audience) => void;
  competitorNames: string[];
  dealNote: string;
  onDealNote: (v: string) => void;
  // Words about customers that had no numbers in them, kept as a note.
  onConsumerNote: (v: string) => void;
  onDealsUploaded: () => void;
  onMetricsSaved: () => void;
}) {
  const [tab, setTab] = useState<Side>("business");
  const side: Side = audience === "both" ? tab : audience === "consumer" ? "consumer" : "business";
  const copy = dataCopy(side);
  const first = competitorNames[0] || "a competitor";

  return (
    <div className="space-y-4">
      <AudiencePicker value={audience} onChange={onAudience} />

      {audience === "both" ? (
        <div role="tablist" aria-label="Which side to add" className="flex gap-2 border-b border-border">
          {([
            ["business", "Business deals"],
            ["consumer", "Consumer churn"],
          ] as const).map(([s, label]) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={tab === s}
              onClick={() => setTab(s)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                tab === s ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {side === "consumer" ? (
        <ChurnDataCard competitorNames={competitorNames} onSaved={onMetricsSaved} onNote={onConsumerNote} />
      ) : (
        <div className="space-y-3">
          <Textarea
            value={dealNote}
            onChange={(e) => onDealNote(e.target.value)}
            rows={3}
            className="max-h-44 overflow-y-auto"
            maxLength={TYPED_LIMIT}
            aria-label={copy.noteLabel}
            placeholder={copy.notePlaceholder(first)}
          />
          {dealNote.length >= TYPED_LIMIT - 200 ? (
            <p role="alert" className="text-xs text-destructive">
              That&apos;s about as much as fits here. For a longer list, upload a CSV below, or attach it in Claude or ChatGPT.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <DealFileUpload label="Upload a CSV" onDone={onDealsUploaded} compact />
            <span className="text-xs text-muted-foreground">{copy.noteHelp}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Have a big list? Upload it above, or attach it in Claude or ChatGPT. It can pull from HubSpot, Salesforce or Gong too, so there&apos;s
            nothing to connect.
          </p>
          <CopyPromptButton text={PULL_DEALS_PROMPT} label="Copy a prompt for it" />
        </div>
      )}
    </div>
  );
}
