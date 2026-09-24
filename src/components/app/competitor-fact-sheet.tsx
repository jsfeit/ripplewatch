"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Printer, RefreshCw, ThumbsDown, ThumbsUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import type { WinLossOutcome } from "@/lib/supabase/types";
import { WinLossReasonSummary, type WinLossEntry } from "@/components/app/win-loss-reason-summary";
import { formatWinLossImportMessage, type ImportMessageData } from "@/lib/win-loss-import";

// Bullets are cached on the competitor row as newline-joined text (see the
// fact-sheet API route) rather than jsonb, split back into a list here,
// dropping any blank lines.
function toBullets(text: string | null): string[] {
  return (text ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
}

export function CompetitorFactSheet({
  competitorId,
  competitorName,
  accountName,
  hubspotConnected,
  initialWhyWeWin,
  initialWhyWeLose,
  initialGeneratedAt,
  initialWinLoss,
  showWinLoss = true,
  showChurn = false,
}: {
  competitorId: string;
  competitorName: string;
  accountName: string;
  hubspotConnected: boolean;
  initialWhyWeWin: string | null;
  initialWhyWeLose: string | null;
  initialGeneratedAt: string | null;
  initialWinLoss: WinLossEntry[];
  // Onboarding's has_sales_crm/has_plg decide which of these an account
  // sees — win/loss is inherently sales-deal shaped (won/lost against a
  // named competitor) and doesn't fit a self-serve/PLG product where
  // customers churn rather than lose a deal. Both can be true (hybrid).
  showWinLoss?: boolean;
  showChurn?: boolean;
}) {
  const [whyWeWin, setWhyWeWin] = useState(toBullets(initialWhyWeWin));
  const [whyWeLose, setWhyWeLose] = useState(toBullets(initialWhyWeLose));
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [nudgeOpen, setNudgeOpen] = useState(false);

  const [entries, setEntries] = useState(initialWinLoss);
  const [formOpen, setFormOpen] = useState(false);
  const [outcome, setOutcome] = useState<WinLossOutcome>("lost");
  const [reason, setReason] = useState("");
  const [savingEntry, setSavingEntry] = useState(false);

  const [churnReason, setChurnReason] = useState("");
  const [savingChurn, setSavingChurn] = useState(false);
  const [churnMessage, setChurnMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  // CSV/HubSpot import is account-wide (one file or sync can touch every
  // competitor, not just this one), so the insert response only carries
  // counts, not rows — refetch this competitor's own entries afterward
  // rather than trying to reconstruct them from a count.
  async function refetchEntries() {
    const supabase = createClient();
    const { data } = await supabase
      .from("competitor_win_loss")
      .select("id, outcome, reason, created_at")
      .eq("competitor_id", competitorId)
      .order("created_at", { ascending: false });
    if (data) setEntries(data);
  }

  async function handleCsvFile(file: File) {
    setUploading(true);
    setImportMessage(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/competitors/win-loss/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setImportMessage(formatWinLossImportMessage("CSV", data as ImportMessageData, true));
      await refetchEntries();
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleHubspotSync() {
    setSyncing(true);
    setImportMessage(null);
    try {
      const res = await fetch("/api/competitors/win-loss/sync-hubspot", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed.");
      setImportMessage(formatWinLossImportMessage("HubSpot", data as ImportMessageData, true));
      await refetchEntries();
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function generate() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch(`/api/competitors/${competitorId}/fact-sheet`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setWhyWeWin(data.whyWeWin ?? []);
      setWhyWeLose(data.whyWeLose ?? []);
      setGeneratedAt(data.generatedAt ?? null);
    } catch {
      setGenError("Couldn't generate the fact sheet, try again.");
    } finally {
      setGenerating(false);
    }
  }

  // Nudge every time there's nothing logged yet, on both the first
  // generation and any refresh, since the "why we win" side stays thin
  // until there's real evidence behind it. Only applies when win/loss is
  // the account's shown log — a churn-only (PLG) account has no
  // client-visible "entries" list to check (churn_notes is a server-side
  // blob, not fetched here), so nudging it toward a UI it doesn't have
  // would be actively wrong.
  function handleGenerateClick() {
    if (showWinLoss && entries.length === 0) {
      setNudgeOpen(true);
      return;
    }
    generate();
  }

  async function addEntry() {
    if (!reason.trim()) return;
    setSavingEntry(true);
    try {
      const res = await fetch(`/api/competitors/${competitorId}/win-loss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, reason: reason.trim() }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEntries((prev) => [data.entry, ...prev]);
      setReason("");
      setFormOpen(false);
    } catch {
      // Left in the form so nothing typed is lost; the button just stops spinning.
    } finally {
      setSavingEntry(false);
    }
  }

  async function deleteEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/competitors/${competitorId}/win-loss/${id}`, { method: "DELETE" }).catch(() => {});
  }

  // Account-wide, not competitor-scoped (see /api/accounts/win-loss) —
  // this page is just the nearest natural place a PLG account is already
  // looking at evidence-gathering UI, same reasoning as the general lost/
  // won notes already surfaced here. Deliberately no competitor picker
  // here (unlike the main Win/loss page): churn logged from one
  // competitor's own fact sheet page staying unattributed by default keeps
  // this page's original framing — a customer who cancels rarely names
  // who they switched to.
  async function addChurnReason() {
    if (!churnReason.trim()) return;
    setSavingChurn(true);
    setChurnMessage(null);
    try {
      const res = await fetch("/api/accounts/win-loss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitorId: null, outcome: "churned", reason: churnReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      setChurnReason("");
      setChurnMessage("Logged. This account-wide context feeds every fact sheet and signal scoring.");
    } catch (err) {
      setChurnMessage(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSavingChurn(false);
    }
  }

  return (
    <div className="mt-8 rounded-lg border-2 border-primary/30 bg-primary/[0.02] p-4 print:border-none print:bg-transparent print:p-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">Fact sheet</h2>
            <Badge className="border-primary/30 bg-primary/15 text-primary">One-to-one comparison</Badge>
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">
            {accountName} vs. <span className="text-primary">{competitorName}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground print:hidden">
            For your team, not for prospects. Grounded only in logged wins/losses, real signals, and researched
            positioning, never an invented feature claim.
          </p>
        </div>
        <div className="flex shrink-0 gap-2 print:hidden">
          {generatedAt ? (
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="size-3.5" />
              Print
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={handleGenerateClick} disabled={generating}>
            {generating ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            {generatedAt ? "Refresh" : "Generate"}
          </Button>
        </div>
      </div>

      {genError ? <p className="mt-2 text-xs text-destructive">{genError}</p> : null}

      {generatedAt ? (
        <>
          <p className="mt-3 text-[11px] text-muted-foreground print:hidden">
            Generated {new Date(generatedAt).toLocaleDateString()}
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 print:grid-cols-2">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <ThumbsUp className="size-3.5" />
                Why we win
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {whyWeWin.map((b, i) => (
                  <li key={i} className="text-foreground">
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <ThumbsDown className="size-3.5" />
                Why we lose
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {whyWeLose.map((b, i) => (
                  <li key={i} className="text-foreground">
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground print:hidden">
          Not generated yet. Click Generate to build it from {competitorName}&apos;s signals, pricing, and any
          logged wins/losses below.
        </p>
      )}

      {showWinLoss ? (
      <div className="mt-6 border-t border-border pt-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-muted-foreground">Win/Loss log</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCsvFile(file);
              }}
            />
            <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              Upload CSV
            </Button>
            {hubspotConnected ? (
              <Button variant="ghost" size="sm" onClick={handleHubspotSync} disabled={syncing}>
                {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                Sync HubSpot
              </Button>
            ) : (
              <Link href="/app/settings" className="text-xs text-muted-foreground underline">
                Connect HubSpot
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={() => setFormOpen((v) => !v)}>
              <Plus className="size-3.5" />
              Log a win/loss
            </Button>
          </div>
        </div>

        {uploading || syncing ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Processing... large files can take a minute or two, this reads every row.
          </p>
        ) : importMessage ? (
          <p className="mt-1.5 text-xs text-muted-foreground">{importMessage}</p>
        ) : null}

        {entries.length === 0 ? (
          <div className="mt-2 flex items-start gap-2.5 rounded-lg border border-primary/25 bg-primary/[0.04] p-3">
            <Plus className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-medium text-foreground">
                No wins or losses logged yet against {competitorName}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                The more you log, the sharper this fact sheet gets, especially &quot;why we win,&quot; which is
                thin without real evidence. Use Upload CSV, Sync HubSpot, or Log a win/loss above.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <WinLossReasonSummary
              entries={entries}
              subjectLabel={`against ${competitorName}`}
              onDeleteEntry={deleteEntry}
            />
          </div>
        )}

        {formOpen ? (
          <div className="mt-3 space-y-2 rounded-md border border-border p-3">
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant={outcome === "lost" ? "default" : "outline"}
                size="sm"
                onClick={() => setOutcome("lost")}
              >
                Lost
              </Button>
              <Button
                type="button"
                variant={outcome === "won" ? "default" : "outline"}
                size="sm"
                onClick={() => setOutcome("won")}
              >
                Won
              </Button>
            </div>
            <Textarea
              placeholder={
                outcome === "lost"
                  ? "e.g. Lost this deal, they were $30/mo cheaper on the entry tier"
                  : "e.g. Won this deal, they don't offer our SSO integration"
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={addEntry} disabled={savingEntry || !reason.trim()}>
                {savingEntry ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      ) : null}

      {showChurn ? (
        <div className="mt-6 border-t border-border pt-4 print:hidden">
          <p className="text-xs font-semibold text-muted-foreground">Customer churn</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Account-wide, not specific to {competitorName}: churn reasons rarely name one competitor the way a
            lost sales deal does. Feeds every fact sheet and signal scoring the same way lost-deal reasons do for
            sales-led accounts.
          </p>
          <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-primary/25 bg-primary/[0.04] p-3">
            <Plus className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="w-full space-y-2">
              <p className="text-xs font-medium text-foreground">Log a churn reason</p>
              <Textarea
                placeholder="e.g. Churned after 2 months, said RivalSense's onboarding was easier to get started with"
                value={churnReason}
                onChange={(e) => setChurnReason(e.target.value)}
                rows={2}
              />
              <div className="flex items-center justify-between gap-2">
                {churnMessage ? <p className="text-xs text-muted-foreground">{churnMessage}</p> : <span />}
                <Button size="sm" onClick={addChurnReason} disabled={savingChurn || !churnReason.trim()}>
                  {savingChurn ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={nudgeOpen} onOpenChange={setNudgeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No win/loss data logged yet</DialogTitle>
            <DialogDescription>
              This fact sheet gets meaningfully more accurate with real wins and losses against{" "}
              {competitorName}, especially the &quot;why we win&quot; side, which otherwise leans on positioning
              and pricing structure alone. Log one now, or generate with what&apos;s already available.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNudgeOpen(false);
                setFormOpen(true);
              }}
            >
              Log a win/loss first
            </Button>
            <Button
              onClick={() => {
                setNudgeOpen(false);
                generate();
              }}
            >
              Generate anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
