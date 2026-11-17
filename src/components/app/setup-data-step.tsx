"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AudiencePicker } from "@/components/app/audience-picker";
import { ChurnDataCard } from "@/components/app/churn-data-card";
import { DealFileUpload } from "@/components/app/deal-file-upload";
import { toolsForAudience } from "@/lib/deal-tools";
import { dataCopy, type Audience } from "@/lib/sales-motion";
import { cn } from "@/lib/utils";

type Side = "business" | "consumer";

// The body of the "bring your data" setup step. B2B sees deals, B2C sees churn and growth, and a
// company that sells to both gets a tab for each, either of which can be skipped.
export function SetupDataStep({
  audience,
  onAudience,
  competitorNames,
  dealNote,
  onDealNote,
  consumerNote,
  onConsumerNote,
  dealTools,
  onDealTools,
  onDealsUploaded,
  onMetricsSaved,
}: {
  audience: Audience | null;
  onAudience: (next: Audience) => void;
  competitorNames: string[];
  dealNote: string;
  onDealNote: (v: string) => void;
  consumerNote: string;
  onConsumerNote: (v: string) => void;
  dealTools: string[];
  onDealTools: (next: string[]) => void;
  onDealsUploaded: () => void;
  onMetricsSaved: () => void;
}) {
  const [tab, setTab] = useState<Side>("business");
  const sides: Side[] = audience === "both" ? [tab] : [audience === "consumer" ? "consumer" : "business"];
  const first = competitorNames[0] || "a competitor";

  function renderSide(side: Side) {
    const copy = dataCopy(side);
    const note = side === "consumer" ? consumerNote : dealNote;
    const setNote = side === "consumer" ? onConsumerNote : onDealNote;
    return (
      <div key={side} className="space-y-5">
        {side === "consumer" ? (
          <>
            <ChurnDataCard competitorNames={competitorNames} onSaved={onMetricsSaved} />
            <p className="border-t border-border pt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Anything you know about individual customers (optional)
            </p>
          </>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor={`note-${side}`}>{copy.noteLabel}</Label>
          <Textarea
            id={`note-${side}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={copy.notePlaceholder(first)}
          />
          <p className="text-xs text-muted-foreground">{copy.noteHelp}</p>
        </div>
        <div className="space-y-2">
          <Label>{copy.uploadLabel}</Label>
          <DealFileUpload label={copy.uploadButton} onDone={onDealsUploaded} />
          <p className="text-xs text-muted-foreground">{copy.uploadHelp}</p>
        </div>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Pick any that apply. You can change this later in Settings, under Data.</p>
          <div className="flex flex-wrap gap-2">
            {toolsForAudience(side).map((t) => {
              const on = dealTools.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onDealTools(on ? dealTools.filter((id) => id !== t.id) : [...dealTools, t.id])}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm font-medium",
                    on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{copy.toolsHelp}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AudiencePicker value={audience} onChange={onAudience} />
      {audience === "both" ? (
        <div role="tablist" aria-label="Which side to add" className="flex gap-2 border-b border-border">
          {([
            ["business", "Business deals"],
            ["consumer", "Consumer churn"],
          ] as const).map(([side, label]) => (
            <button
              key={side}
              type="button"
              role="tab"
              aria-selected={tab === side}
              onClick={() => setTab(side)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                tab === side ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {sides.map(renderSide)}
    </div>
  );
}
