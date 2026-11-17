"use client";

import { useCallback, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { AssistantHandoff } from "@/components/app/assistant-handoff";
import { AudiencePicker } from "@/components/app/audience-picker";
import { ChurnDataCard, SurveyPromptRow } from "@/components/app/churn-data-card";
import { ATTACH_PROMPT } from "@/lib/customer-metrics";
import { dataCopy, type Audience } from "@/lib/sales-motion";
import { cn } from "@/lib/utils";

type Side = "business" | "consumer";

const DEALS_PROMPT =
  "Using Ripplewatch: take my closed-won and closed-lost deals from the file I've attached (or my CRM, last 24 months), with the reason for each. Show me what you read first, then add them to Ripplewatch with import_win_loss.";
// The typing box stops here; past it, the assistant does better.
const TYPED_LIMIT = 2000;

// The body of the "bring your data" setup step. It hands the work to the customer's own assistant,
// which can count rows, open Excel and pull from their billing tool or CRM, then watches for the data
// to arrive. A collapsed box covers anyone whose plan can't save to Ripplewatch. A company that sells
// to both gets a tab for each side.
export function SetupDataStep({
  audience,
  onAudience,
  competitorNames,
  assistants,
  dealNote,
  onDealNote,
  onConsumerNote,
  onDealsArrived,
  onMetricsArrived,
}: {
  audience: Audience | null;
  onAudience: (next: Audience) => void;
  competitorNames: string[];
  assistants?: string[];
  dealNote: string;
  onDealNote: (v: string) => void;
  // Words about customers that had no numbers in them, kept as a note.
  onConsumerNote: (v: string) => void;
  onDealsArrived: () => void;
  onMetricsArrived: () => void;
}) {
  const [tab, setTab] = useState<Side>("business");
  const [rising, setRising] = useState(false);
  const onStatus = useCallback((s: { churn: { trend: string | null } }) => setRising(s.churn.trend === "rising"), []);
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
        <>
          <AssistantHandoff
            kind="churn"
            title="Bring your churn in with Claude or ChatGPT"
            blurb="Attach your export (CSV or Excel), or let it pull from Stripe, Shopify or your billing tool. It counts the rows and shows you the table before it saves anything."
            why="Your assistant reads it once. Ripplewatch keeps it, watches your competitors every day, and checks each move against your churn. That's Momentum."
            prompt={ATTACH_PROMPT}
            assistants={assistants}
            onArrived={onMetricsArrived}
            onStatus={onStatus}
            fallback={<ChurnDataCard onNote={onConsumerNote} onSaved={onMetricsArrived} fallback />}
          />
          <SurveyPromptRow competitorNames={competitorNames} rising={rising} />
        </>
      ) : (
        <AssistantHandoff
          kind="deals"
          title="Bring your deals in with Claude or ChatGPT"
          blurb="Attach your export (CSV or Excel), or let it pull from HubSpot, Salesforce or Gong. It shows you what it read before it saves anything."
          why="Your assistant reads it once. Ripplewatch keeps it, watches your competitors every day, and checks each move against your deals. That's Momentum."
          prompt={DEALS_PROMPT}
          assistants={assistants}
          onArrived={onDealsArrived}
          fallback={
            <div className="space-y-2">
              <Textarea
                value={dealNote}
                onChange={(e) => onDealNote(e.target.value)}
                rows={3}
                className="max-h-44 overflow-y-auto"
                maxLength={TYPED_LIMIT}
                aria-label={copy.noteLabel}
                placeholder={copy.notePlaceholder(first)}
              />
              <p className="text-xs text-muted-foreground">{copy.noteHelp}</p>
            </div>
          }
        />
      )}
    </div>
  );
}
