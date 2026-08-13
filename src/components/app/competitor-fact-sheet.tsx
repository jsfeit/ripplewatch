"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Loader2, Plus, Printer, RefreshCw, Trash2, ThumbsDown, ThumbsUp, Upload } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { WinLossOutcome } from "@/lib/supabase/types";

type WinLossEntry = {
  id: string;
  outcome: WinLossOutcome;
  reason: string | null;
  created_at: string;
};

// Bullets are cached on the competitor row as newline-joined text (see the
// fact-sheet API route) rather than jsonb, split back into a list here,
// dropping any blank lines.
function toBullets(text: string | null): string[] {
  return (text ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
}

type ImportResponse = {
  totalExtracted: number;
  imported: number;
  skipped: number;
  generalReasonsAdded: number;
  generalReasonsSkipped: number;
  generalWonReasonsAdded: number;
  generalWonReasonsSkipped: number;
  suggestedCompetitors: string[];
  untrackedAlreadySuggested: number;
  rowsConsidered?: number;
  totalRows?: number;
  truncated?: boolean;
};

// Always leads with what was actually read/found (rowsConsidered,
// totalExtracted) rather than only the net-new counts — re-running the same
// file, or one that overlaps a prior import, should read as "found N, all
// already known" instead of looking identical to a genuinely empty or
// irrelevant file (both would otherwise show all-zero net-new counts).
function formatImportMessage(source: string, data: ImportResponse): string {
  const rowsPart =
    data.rowsConsidered !== undefined ? `read ${data.rowsConsidered} row${data.rowsConsidered === 1 ? "" : "s"}, ` : "";
  const parts = [`${source}: ${rowsPart}found ${data.totalExtracted} relevant ${data.totalExtracted === 1 ? "entry" : "entries"}`];

  const generalSkippedNote = data.generalReasonsSkipped > 0 ? `, ${data.generalReasonsSkipped} already known` : "";
  const generalWonSkippedNote = data.generalWonReasonsSkipped > 0 ? `, ${data.generalWonReasonsSkipped} already known` : "";
  const untrackedSkippedNote = data.untrackedAlreadySuggested > 0 ? `, ${data.untrackedAlreadySuggested} already suggested` : "";

  parts.push(`imported ${data.imported} win/loss ${data.imported === 1 ? "entry" : "entries"}${data.skipped > 0 ? ` (${data.skipped} already logged)` : ""}.`);
  if (data.generalReasonsAdded > 0 || data.generalReasonsSkipped > 0) {
    parts.push(`Added ${data.generalReasonsAdded} general lost-deal reason${data.generalReasonsAdded === 1 ? "" : "s"} to account context${generalSkippedNote}.`);
  }
  if (data.generalWonReasonsAdded > 0 || data.generalWonReasonsSkipped > 0) {
    parts.push(`Added ${data.generalWonReasonsAdded} general win reason${data.generalWonReasonsAdded === 1 ? "" : "s"} to account context${generalWonSkippedNote}.`);
  }
  if (data.suggestedCompetitors.length > 0 || data.untrackedAlreadySuggested > 0) {
    const suggestedPart =
      data.suggestedCompetitors.length > 0
        ? `suggested ${data.suggestedCompetitors.length} untracked competitor${data.suggestedCompetitors.length === 1 ? "" : "s"} (${data.suggestedCompetitors.join(", ")})`
        : "no new competitors to suggest";
    parts.push(`${suggestedPart}${untrackedSkippedNote}. See the Competitors page.`);
  }
  if (data.totalExtracted === 0) {
    parts.push("(nothing in this file had enough signal to keep)");
  }
  if (data.truncated && data.rowsConsidered !== undefined && data.totalRows !== undefined) {
    parts.push(`Only processed the first ${data.rowsConsidered} of ${data.totalRows} rows.`);
  }
  return `${parts[0]}. ${parts.slice(1).join(" ")}`.trim();
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
  const [showAllEntries, setShowAllEntries] = useState(false);
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
      setImportMessage(formatImportMessage("CSV", data));
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
      setImportMessage(formatImportMessage("HubSpot", data));
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

  // Account-wide, not competitor-scoped (see /api/accounts/churn) — this
  // page is just the nearest natural place a PLG account is already
  // looking at evidence-gathering UI, same reasoning as the general lost/
  // won notes already surfaced here.
  async function addChurnReason() {
    if (!churnReason.trim()) return;
    setSavingChurn(true);
    setChurnMessage(null);
    try {
      const res = await fetch("/api/accounts/churn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: churnReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      setChurnReason("");
      setChurnMessage("Logged. This account-wide context feeds every fact sheet and alert scoring.");
    } catch (err) {
      setChurnMessage(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSavingChurn(false);
    }
  }

  // A large CSV import (hundreds of rows) otherwise renders as one entry
  // per row — unreadable, and most reasons repeat verbatim (a CRM's own
  // dropdown of canned reasons, in practice). Grouped by exact reason text
  // (case/whitespace-insensitive) rather than an LLM call: deterministic,
  // free, and this data is already close-ended enough that exact matching
  // does the job — fuzzy synthesis across freeform text is what Trends is
  // for, not this list.
  const reasonGroups = useMemo(() => {
    const groups = new Map<string, { reason: string; wonCount: number; lostCount: number }>();
    for (const e of entries) {
      const key = e.reason ? e.reason.trim().toLowerCase() : "__no_reason__";
      const existing = groups.get(key);
      if (existing) {
        if (e.outcome === "won") existing.wonCount++;
        else existing.lostCount++;
      } else {
        groups.set(key, {
          reason: e.reason?.trim() || "No reason given",
          wonCount: e.outcome === "won" ? 1 : 0,
          lostCount: e.outcome === "lost" ? 1 : 0,
        });
      }
    }
    return Array.from(groups.values());
  }, [entries]);

  // Top 5 each, ranked within their own column — a reason that's mostly a
  // win reason but shows up a couple times on the loss side (or vice versa)
  // can legitimately appear in both, same as the fact sheet's own Why we
  // win/Why we lose columns above already allow.
  const TOP_N = 5;
  const winReasons = useMemo(
    () => reasonGroups.filter((g) => g.wonCount > 0).sort((a, b) => b.wonCount - a.wonCount).slice(0, TOP_N),
    [reasonGroups]
  );
  const lossReasons = useMemo(
    () => reasonGroups.filter((g) => g.lostCount > 0).sort((a, b) => b.lostCount - a.lostCount).slice(0, TOP_N),
    [reasonGroups]
  );
  const winReasonsTotal = reasonGroups.filter((g) => g.wonCount > 0).length;
  const lossReasonsTotal = reasonGroups.filter((g) => g.lostCount > 0).length;
  const maxWinCount = Math.max(1, ...winReasons.map((g) => g.wonCount));
  const maxLossCount = Math.max(1, ...lossReasons.map((g) => g.lostCount));

  const wonTotal = entries.filter((e) => e.outcome === "won").length;
  const lostTotal = entries.length - wonTotal;

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
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-muted-foreground">Win/loss log</p>
            {entries.length > 0 ? (
              <span className="text-[11px] text-muted-foreground">
                <span className="font-semibold text-primary">{wonTotal} won</span> ·{" "}
                <span className="font-semibold text-amber-600 dark:text-amber-400">{lostTotal} lost</span> against{" "}
                {competitorName}
              </span>
            ) : null}
          </div>
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
          <>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <ThumbsUp className="size-3.5" />
                  Top reasons we win
                </p>
                <ul className="mt-2 space-y-2">
                  {winReasons.map((g) => (
                    <li key={g.reason}>
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="text-foreground">{g.reason}</span>
                        <span className="shrink-0 font-semibold text-primary">{g.wonCount}</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-primary/10">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(g.wonCount / maxWinCount) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
                {winReasonsTotal > TOP_N ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">+{winReasonsTotal - TOP_N} more</p>
                ) : null}
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <ThumbsDown className="size-3.5" />
                  Top reasons we lose
                </p>
                <ul className="mt-2 space-y-2">
                  {lossReasons.map((g) => (
                    <li key={g.reason}>
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="text-foreground">{g.reason}</span>
                        <span className="shrink-0 font-semibold text-amber-600 dark:text-amber-400">
                          {g.lostCount}
                        </span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-amber-500/10">
                        <div
                          className="h-full rounded-full bg-amber-500"
                          style={{ width: `${(g.lostCount / maxLossCount) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
                {lossReasonsTotal > TOP_N ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">+{lossReasonsTotal - TOP_N} more</p>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAllEntries((v) => !v)}
              className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={cn("size-3 transition-transform", showAllEntries && "rotate-180")} />
              {showAllEntries ? "Hide" : "Show"} all {entries.length} individual entries
            </button>

            {showAllEntries ? (
              <ul className="mt-2 space-y-2">
                {entries.map((e) => (
                  <li key={e.id} className="flex items-start gap-2 rounded-md border border-border p-2 text-xs">
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
                        e.outcome === "won"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      )}
                    >
                      {e.outcome === "won" ? "Won" : "Lost"}
                    </span>
                    <span className={cn("flex-1", e.reason ? "text-foreground" : "italic text-muted-foreground")}>
                      {e.reason ?? "No reason given"}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteEntry(e.id)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Delete entry"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
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
            Account-wide, not specific to {competitorName} — churn reasons rarely name one competitor the way a
            lost sales deal does. Feeds every fact sheet and alert scoring the same way lost-deal reasons do for
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
