"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, RefreshCw, Scale, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/app/empty-state";
import { WinLossReasonSummary, type WinLossEntry } from "@/components/app/win-loss-reason-summary";
import { createClient } from "@/lib/supabase/client";
import { avatarColor, cn } from "@/lib/utils";
import type { WinLossOutcome } from "@/lib/supabase/types";

type Competitor = { id: string; name: string };
type AccountEntry = WinLossEntry & { competitor_id: string };

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

// Mirrors competitor-fact-sheet.tsx's formatImportMessage exactly — same
// import routes, same response shape, just no per-competitor framing since
// this page already spans every competitor.
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

export function WinLossPageClient({
  competitors,
  initialEntries,
  hubspotConnected,
  showWinLoss,
  showChurn,
}: {
  competitors: Competitor[];
  initialEntries: AccountEntry[];
  hubspotConnected: boolean;
  showWinLoss: boolean;
  showChurn: boolean;
}) {
  const [entries, setEntries] = useState(initialEntries);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState(competitors[0]?.id ?? "");
  const [outcome, setOutcome] = useState<WinLossOutcome>("lost");
  const [reason, setReason] = useState("");
  const [savingEntry, setSavingEntry] = useState(false);

  const [churnReason, setChurnReason] = useState("");
  const [savingChurn, setSavingChurn] = useState(false);
  const [churnMessage, setChurnMessage] = useState<string | null>(null);

  const competitorIds = useMemo(() => competitors.map((c) => c.id), [competitors]);

  async function refetchEntries() {
    if (competitorIds.length === 0) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("competitor_win_loss")
      .select("id, competitor_id, outcome, reason, created_at")
      .in("competitor_id", competitorIds)
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

  async function addEntry() {
    if (!reason.trim() || !selectedCompetitorId) return;
    setSavingEntry(true);
    try {
      const res = await fetch(`/api/competitors/${selectedCompetitorId}/win-loss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, reason: reason.trim() }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEntries((prev) => [{ ...data.entry, competitor_id: selectedCompetitorId }, ...prev]);
      setReason("");
      setFormOpen(false);
    } catch {
      // Left in the form so nothing typed is lost; the button just stops spinning.
    } finally {
      setSavingEntry(false);
    }
  }

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

  const byCompetitor = useMemo(() => {
    const map = new Map<string, AccountEntry[]>();
    for (const c of competitors) map.set(c.id, []);
    for (const e of entries) {
      const list = map.get(e.competitor_id);
      if (list) list.push(e);
    }
    return map;
  }, [competitors, entries]);

  if (competitors.length === 0) {
    return (
      <EmptyState
        icon={Scale}
        title="No competitors yet"
        description="Add competitors first, then come back here to log or import win/loss data against them."
      />
    );
  }

  return (
    <div className="space-y-8">
      {showWinLoss ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Win/loss data</h2>
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
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                Upload CSV
              </Button>
              {hubspotConnected ? (
                <Button variant="outline" size="sm" onClick={handleHubspotSync} disabled={syncing}>
                  {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                  Sync HubSpot
                </Button>
              ) : (
                <Link href="/app/settings" className="text-xs text-muted-foreground underline">
                  Connect HubSpot
                </Link>
              )}
              <Button size="sm" onClick={() => setFormOpen((v) => !v)}>
                <Plus className="size-3.5" />
                Log a win/loss
              </Button>
            </div>
          </div>

          {uploading || syncing ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Processing... large files can take a minute or two, this reads every row.
            </p>
          ) : importMessage ? (
            <p className="mt-2 text-xs text-muted-foreground">{importMessage}</p>
          ) : null}

          {formOpen ? (
            <div className="mt-3 space-y-2 rounded-md border border-border p-3">
              <Select value={selectedCompetitorId} onValueChange={(v) => v && setSelectedCompetitorId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Which competitor?" />
                </SelectTrigger>
                <SelectContent>
                  {competitors.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <Button
                  size="sm"
                  onClick={addEntry}
                  disabled={savingEntry || !reason.trim() || !selectedCompetitorId}
                >
                  {savingEntry ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </div>
          ) : null}

          {entries.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No wins or losses logged yet. Upload a CSV, sync HubSpot, or log one manually above — the more you
              log, the sharper every fact sheet gets.
            </p>
          ) : (
            <div className="mt-4 border-t border-border pt-4">
              <WinLossReasonSummary entries={entries} subjectLabel="across all competitors" />
            </div>
          )}
        </div>
      ) : null}

      {showChurn ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Customer churn</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Account-wide, not tied to one competitor — churn reasons rarely name who a customer switched to the
            way a lost sales deal does. Feeds every fact sheet and alert scoring the same way lost-deal reasons
            do for sales-led accounts.
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

      {entries.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold">By competitor</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {competitors.map((c) => {
              const list = byCompetitor.get(c.id) ?? [];
              const won = list.filter((e) => e.outcome === "won").length;
              const lost = list.length - won;
              return (
                <Link
                  key={c.id}
                  href={`/app/competitors/${c.id}#fact-sheet`}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-border/80 hover:bg-secondary/30"
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      avatarColor(c.name)
                    )}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {list.length === 0 ? (
                        "Nothing logged yet"
                      ) : (
                        <>
                          <span className="font-semibold text-primary">{won} won</span> ·{" "}
                          <span className="font-semibold text-amber-600 dark:text-amber-400">{lost} lost</span>
                        </>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">View fact sheet →</span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
