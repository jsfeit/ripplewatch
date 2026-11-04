"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { WinLossEmailAddress } from "@/components/app/win-loss-email-address";
import { DealFileUpload } from "@/components/app/deal-file-upload";
import { DealIntelligencePanel, type DealIntelligenceProps } from "@/components/app/deal-intelligence";
import { cn } from "@/lib/utils";
import {
  DEAL_TOOLS,
  dealToolsServerSnapshot,
  dealToolsSnapshot,
  parseDealTools,
  promptForTool,
  scheduledRecipes,
  saveDealTools,
  subscribeDealTools,
} from "@/lib/deal-tools";

type Competitor = { id: string; name: string };

const NOT_SURE = "none";

// "Bring your data": where a Connect customer lands after setup. Their own
// deal history is what turns generic competitor news into answers about their
// market, so every easy way in is on one page: type a deal, email a list,
// upload a file, or have their assistant pull it from a tool it can already
// reach. There is deliberately no OAuth here: the assistant reads the other
// tool through that tool's own MCP and hands the rows to Ripplewatch.
export function ConnectDataPanel({
  inboxAddress,
  competitors,
  dealIntel,
}: {
  inboxAddress: string;
  competitors: Competitor[];
  dealIntel?: DealIntelligenceProps;
}) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<"won" | "lost">("lost");
  const [competitorId, setCompetitorId] = useState(competitors[0]?.id ?? NOT_SURE);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [dealMessage, setDealMessage] = useState<string | null>(null);

  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  const first = competitors[0]?.name ?? "my main competitor";
  // The tools picked during setup (or here), read from this browser without
  // a server/client mismatch.
  const selectedTools = parseDealTools(
    useSyncExternalStore(subscribeDealTools, dealToolsSnapshot, dealToolsServerSnapshot)
  );
  const genericPrompts = [
    {
      tool: "CRM (HubSpot, Salesforce)",
      text: "From my CRM, pull the deals I lost in the last 90 days with the reason for each, and add them to Ripplewatch.",
    },
    {
      tool: "Call recorder (Gong, Zoom)",
      text: `In my call recorder, find calls from the last 30 days where ${first} came up, and log those mentions in Ripplewatch. A one-line summary of each is fine.`,
    },
    {
      tool: "Support inbox (Intercom, Zendesk)",
      text: "From my support tool, find recent cancellations and why customers left, and add them to Ripplewatch.",
    },
  ];
  const tailored = selectedTools.flatMap((id) => {
    const p = promptForTool(id, first);
    return p ? [p] : [];
  });
  const toolPrompts = tailored.length > 0 ? tailored : genericPrompts;

  async function copyPrompt(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPrompt(text);
      setTimeout(() => setCopiedPrompt(null), 1800);
    } catch {
      // clipboard blocked: the prompt is still readable on screen
    }
  }

  async function saveDeal() {
    if (!reason.trim()) return;
    setSaving(true);
    setDealMessage(null);
    try {
      const res = await fetch("/api/accounts/win-loss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitorId: competitorId === NOT_SURE ? null : competitorId,
          outcome,
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save that.");
      setReason("");
      const name = competitors.find((c) => c.id === competitorId)?.name;
      setDealMessage(
        data.momentum?.score !== null && data.momentum?.score !== undefined && name
          ? `Logged. ${name} now reads ${data.momentum.score > 0 ? "+" : ""}${data.momentum.score} (${data.momentum.label}).`
          : "Logged. Add a few more and I can start spotting patterns."
      );
      // Setup progress in the sidebar and checklist reads deal history.
      router.refresh();
    } catch (err) {
      setDealMessage(err instanceof Error ? err.message : "Could not save that.");
    } finally {
      setSaving(false);
    }
  }

  const noCompetitors = competitors.length === 0;

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Make the answers yours</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The deals you win and lose are what turn generic competitor news into answers about your market. Add them
          whichever way is easiest. Even one helps, and more is better.
        </p>
      </div>

      {dealIntel ? <DealIntelligencePanel {...dealIntel} /> : null}

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-base font-semibold">Tell me about a deal</h3>
        <p className="mt-1 text-sm text-muted-foreground">A win or a loss, and why, in your own words.</p>
        {noCompetitors ? (
          <p className="mt-3 text-sm text-muted-foreground">Add a competitor first, then log deals against them.</p>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {(["lost", "won"] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOutcome(o)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm font-medium capitalize",
                    outcome === o ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                  )}
                >
                  {o}
                </button>
              ))}
              <span className="text-sm text-muted-foreground">against</span>
              <select
                value={competitorId}
                onChange={(e) => setCompetitorId(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {competitors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value={NOT_SURE}>Not sure / no competitor</option>
              </select>
            </div>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="They were $30/mo cheaper on the entry tier and the prospect needed to start this month."
            />
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={saveDeal} disabled={saving || !reason.trim()}>
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Save deal
              </Button>
              {dealMessage ? <p className="text-xs text-muted-foreground">{dealMessage}</p> : null}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-base font-semibold">Email deals in</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste or forward a list of deals to this address and I&apos;ll pull out the reasons. Any layout works.
        </p>
        <div className="mt-3">
          <WinLossEmailAddress address={inboxAddress} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-base font-semibold">Upload a file</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          A CRM export in any layout, as far back as you have. I work out which column is which and show you before I
          save anything. More history, with close dates, makes every answer sharper.
        </p>
        <div className="mt-3">
          <DealFileUpload onDone={() => router.refresh()} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-base font-semibold">Or let your assistant pull it</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          If you&apos;ve connected your CRM, call recorder or support tool to Claude or ChatGPT, it can read them and
          hand the results to me. Nothing to connect here. Say one of these, and it will tell you what it&apos;s about to
          read before it does.
        </p>
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">Which tools do you use?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEAL_TOOLS.map((t) => {
              const on = selectedTools.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => saveDealTools(on ? selectedTools.filter((id) => id !== t.id) : [...selectedTools, t.id])}
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
        </div>
        <ul className="mt-4 space-y-3">
          {toolPrompts.map((p) => (
            <li key={p.tool}>
              <p className="text-xs font-medium text-muted-foreground">{p.tool}</p>
              <button
                type="button"
                onClick={() => void copyPrompt(p.text)}
                className="mt-1 flex w-full items-center justify-between gap-3 rounded-md border border-border bg-secondary/30 px-3 py-2 text-left text-sm hover:border-primary/50"
              >
                <span>{p.text}</span>
                {copiedPrompt === p.text ? (
                  <Check className="size-3.5 shrink-0 text-primary" />
                ) : (
                  <Copy className="size-3.5 shrink-0 text-muted-foreground" />
                )}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Connect the tool to your assistant first, in its connectors settings. Don&apos;t see yours? If it offers a
          connector, this works with it.{selectedTools.includes("gong") ? " Gong shares call summaries rather than full transcripts, so those mentions are logged as one-line summaries." : ""}
        </p>
        <div id="autopilot" className="mt-5 scroll-mt-6 border-t border-border pt-4">
          <h4 className="text-sm font-medium">Put it on autopilot</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Claude and ChatGPT can both run a prompt on a schedule. Paste one of these in once and new deals arrive on
            their own, with a note each time on what was added. The tool still needs to be connected to your assistant,
            and on some ChatGPT plans a connection is read-only, which means it can read your CRM but not save to
            Ripplewatch.
          </p>
          <ul className="mt-3 space-y-3">
            {scheduledRecipes(selectedTools).map((r) => (
              <li key={r.id}>
                <p className="text-xs font-medium text-muted-foreground">
                  {r.title} · {r.cadence}
                </p>
                <button
                  type="button"
                  onClick={() => void copyPrompt(r.text)}
                  className="mt-1 flex w-full items-center justify-between gap-3 rounded-md border border-border bg-secondary/30 px-3 py-2 text-left text-sm hover:border-primary/50"
                >
                  <span>{r.text}</span>
                  {copiedPrompt === r.text ? (
                    <Check className="size-3.5 shrink-0 text-primary" />
                  ) : (
                    <Copy className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
