"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { WinLossEmailAddress } from "@/components/app/win-loss-email-address";
import { formatWinLossImportMessage, type ImportMessageData } from "@/lib/win-loss-import";
import { cn } from "@/lib/utils";

type Competitor = { id: string; name: string };

const NOT_SURE = "none";

// "Bring your data": where a Connect customer lands after setup. Their own
// deal history is what turns generic competitor news into answers about their
// market, so every easy way in is on one page: type a deal, email a list,
// upload a file, or have their assistant pull it from a tool it can already
// reach. There is deliberately no OAuth here: the assistant reads the other
// tool through that tool's own MCP and hands the rows to Ripplewatch.
export function ConnectDataPanel({ inboxAddress, competitors }: { inboxAddress: string; competitors: Competitor[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const [outcome, setOutcome] = useState<"won" | "lost">("lost");
  const [competitorId, setCompetitorId] = useState(competitors[0]?.id ?? NOT_SURE);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [dealMessage, setDealMessage] = useState<string | null>(null);

  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  const first = competitors[0]?.name ?? "my main competitor";
  const toolPrompts = [
    {
      tool: "CRM (HubSpot, Salesforce)",
      text: "From my CRM, pull the deals I lost in the last 90 days with the reason for each, and add them to Ripplewatch.",
    },
    {
      tool: "Call recorder (Gong, Zoom)",
      text: `In my call recorder, find calls from the last 30 days where ${first} came up, and log those mentions in Ripplewatch.`,
    },
    {
      tool: "Support inbox (Intercom, Zendesk)",
      text: "From my support tool, find recent cancellations and why customers left, and add them to Ripplewatch.",
    },
  ];

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

  async function handleFile(file: File) {
    setUploading(true);
    setUploadMessage(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/competitors/win-loss/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setUploadMessage(formatWinLossImportMessage("Upload", data as ImportMessageData, false));
      router.refresh();
    } catch (err) {
      setUploadMessage(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const noCompetitors = competitors.length === 0;

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Make the answers yours</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The deals you win and lose are what turn generic competitor news into answers about your market. Add them
          whichever way is easiest. Even one helps.
        </p>
      </div>

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
          A CRM export or a plain list of deals. I&apos;ll pull out the win/loss and churn reasons for each competitor.
        </p>
        {noCompetitors ? (
          <p className="mt-3 text-sm text-muted-foreground">Add a competitor first, then come back to upload here.</p>
        ) : (
          <div className="mt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              Upload a file
            </Button>
            {uploading ? (
              <p className="mt-2 text-xs text-muted-foreground">Reading it now. A large file can take a minute or two.</p>
            ) : uploadMessage ? (
              <p className="mt-2 text-xs text-muted-foreground">{uploadMessage}</p>
            ) : null}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-base font-semibold">Or let your assistant pull it</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          If you&apos;ve connected your CRM, call recorder or support tool to Claude or ChatGPT, it can read them and
          hand the results to me. Nothing to connect here. Say one of these, and it will tell you what it&apos;s about to
          read before it does.
        </p>
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
          Don&apos;t see your tool? If it offers a connector in Claude or ChatGPT, this works with it.
        </p>
      </div>
    </div>
  );
}
