"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, RefreshCw, Scale, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/app/empty-state";
import { Panel } from "@/components/ui/panel";
import { CardAvatar, CardFoot, CardHead } from "@/components/app/card";
import { WinLossReasonSummary, type WinLossEntry } from "@/components/app/win-loss-reason-summary";
import { createClient } from "@/lib/supabase/client";
import type { WinLossOutcome } from "@/lib/supabase/types";

type Competitor = { id: string; name: string };
type AccountEntry = WinLossEntry & { competitor_id: string };

// Sentinel for "don't know who we lost to / where they churned to" — a
// real competitor_id is a uuid, so this can't collide with one. Kept as a
// plain string (not null) because Base UI's Select needs a non-empty value
// for every item.
const UNKNOWN_COMPETITOR = "unknown";

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
    parts.push(`Added ${data.generalReasonsAdded} unattributed lost-deal reason${data.generalReasonsAdded === 1 ? "" : "s"}${generalSkippedNote}.`);
  }
  if (data.generalWonReasonsAdded > 0 || data.generalWonReasonsSkipped > 0) {
    parts.push(`Added ${data.generalWonReasonsAdded} unattributed win reason${data.generalWonReasonsAdded === 1 ? "" : "s"}${generalWonSkippedNote}.`);
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

function CompetitorPicker({
  competitors,
  value,
  onChange,
  placeholder,
}: {
  competitors: Competitor[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const label = value === UNKNOWN_COMPETITOR ? "Not sure / no competitor" : competitors.find((c) => c.id === value)?.name;
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder}>{() => label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {competitors.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
        <SelectItem value={UNKNOWN_COMPETITOR}>Not sure / no competitor</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function WinLossPageClient({
  competitors,
  initialEntries,
  initialUnattributedEntries,
  correlationNote,
  hubspotConnected,
  showWinLoss,
  showChurn,
}: {
  competitors: Competitor[];
  initialEntries: AccountEntry[];
  // Entries with no competitor identified (competitor_id null) — most lost
  // deals and nearly all B2C churn, per 0061_win_loss_unattributed_and_churn.
  // Still real, dated data: just not attributable to one competitor.
  initialUnattributedEntries: WinLossEntry[];
  // Server-computed (churn-correlation.ts): whether recent unattributed
  // losses/churn coincide with a tracked competitor's pricing/product
  // moves. Null when there's nothing worth saying yet.
  correlationNote: string | null;
  hubspotConnected: boolean;
  showWinLoss: boolean;
  showChurn: boolean;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [unattributedEntries, setUnattributedEntries] = useState(initialUnattributedEntries);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState(competitors[0]?.id ?? UNKNOWN_COMPETITOR);
  const [outcome, setOutcome] = useState<WinLossOutcome>("lost");
  const [reason, setReason] = useState("");
  const [savingEntry, setSavingEntry] = useState(false);
  const [momentumMessage, setMomentumMessage] = useState<string | null>(null);

  const [churnCompetitorId, setChurnCompetitorId] = useState(UNKNOWN_COMPETITOR);
  const [churnReason, setChurnReason] = useState("");
  const [savingChurn, setSavingChurn] = useState(false);
  const [churnMessage, setChurnMessage] = useState<string | null>(null);

  const competitorIds = useMemo(() => competitors.map((c) => c.id), [competitors]);

  async function refetchEntries() {
    const supabase = createClient();
    if (competitorIds.length > 0) {
      const { data } = await supabase
        .from("competitor_win_loss")
        .select("id, competitor_id, outcome, reason, created_at")
        .in("competitor_id", competitorIds)
        .order("created_at", { ascending: false });
      if (data) setEntries(data as AccountEntry[]);
    }
    const { data: unattributed } = await supabase
      .from("competitor_win_loss")
      .select("id, outcome, reason, created_at")
      .is("competitor_id", null)
      .order("created_at", { ascending: false });
    if (unattributed) setUnattributedEntries(unattributed);
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
    if (!reason.trim()) return;
    setSavingEntry(true);
    setMomentumMessage(null);
    const competitorId = selectedCompetitorId === UNKNOWN_COMPETITOR ? null : selectedCompetitorId;
    try {
      const res = await fetch("/api/accounts/win-loss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitorId, outcome, reason: reason.trim() }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (competitorId) {
        setEntries((prev) => [{ ...data.entry, competitor_id: competitorId }, ...prev]);
      } else {
        setUnattributedEntries((prev) => [data.entry, ...prev]);
      }
      setReason("");
      setFormOpen(false);

      if (!competitorId) {
        setMomentumMessage("Logged without a competitor. It still counts, and now feeds the unattributed trend below.");
      } else {
        // Immediate payoff: show the Momentum shift right here instead of
        // making them navigate to the dashboard to discover it happened.
        const competitorName = competitors.find((c) => c.id === competitorId)?.name ?? "This competitor";
        if (data.momentum?.score !== null && data.momentum?.score !== undefined) {
          const sign = data.momentum.score > 0 ? "+" : "";
          const confidenceNote = data.momentum.confidence === "low" ? " (still based on limited data)" : "";
          setMomentumMessage(
            `Momentum updated: ${competitorName} is now ${sign}${data.momentum.score} ${data.momentum.label}${confidenceNote}.`
          );
        } else {
          setMomentumMessage(`Logged. Add a few more for ${competitorName} to start showing a Momentum win-rate trend.`);
        }
      }
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
    const competitorId = churnCompetitorId === UNKNOWN_COMPETITOR ? null : churnCompetitorId;
    try {
      const res = await fetch("/api/accounts/win-loss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitorId, outcome: "churned", reason: churnReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      if (competitorId) {
        setEntries((prev) => [{ ...data.entry, competitor_id: competitorId }, ...prev]);
      } else {
        setUnattributedEntries((prev) => [data.entry, ...prev]);
      }
      setChurnReason("");
      setChurnMessage("Logged. Feeds every fact sheet and alert scoring, whether or not a competitor was named.");
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
        <Panel className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Win/Loss data</h2>
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

          {momentumMessage ? (
            <p className="mt-2 rounded-md border border-primary/20 bg-primary/[0.04] px-2.5 py-1.5 text-xs font-medium text-foreground">
              {momentumMessage}
            </p>
          ) : null}

          {formOpen ? (
            <div className="mt-3 space-y-2 rounded-md border border-border p-3">
              <p className="text-[11px] text-muted-foreground">
                Don&rsquo;t know who won or lost the deal? That&rsquo;s normal, pick &ldquo;Not sure&rdquo; below, it
                still counts.
              </p>
              <CompetitorPicker
                competitors={competitors}
                value={selectedCompetitorId}
                onChange={setSelectedCompetitorId}
                placeholder="Which competitor?"
              />
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

          {entries.length === 0 && unattributedEntries.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No wins or losses logged yet. Upload a CSV, sync HubSpot, or log one manually above: the more you
              log, the sharper every fact sheet gets.
            </p>
          ) : (
            <div className="mt-4 border-t border-border pt-4">
              <WinLossReasonSummary entries={[...entries, ...unattributedEntries]} subjectLabel="across all competitors" />
            </div>
          )}
        </Panel>
      ) : null}

      {showChurn ? (
        <Panel className="p-5">
          <h2 className="text-sm font-semibold">Customer churn</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Rarely names who a customer switched to the way a lost sales deal does, so a competitor is optional here.
            Feeds every fact sheet and alert scoring the same way lost-deal reasons do for sales-led accounts.
          </p>
          <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-primary/25 bg-primary/[0.04] p-3">
            <Plus className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="w-full space-y-2">
              <p className="text-xs font-medium text-foreground">Log a churn reason</p>
              {competitors.length > 0 ? (
                <CompetitorPicker
                  competitors={competitors}
                  value={churnCompetitorId}
                  onChange={setChurnCompetitorId}
                  placeholder="Switched to a competitor? (optional)"
                />
              ) : null}
              <Textarea
                placeholder="e.g. Churned after 2 months, said onboarding was easier somewhere else"
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
        </Panel>
      ) : null}

      {unattributedEntries.length > 0 ? (
        <Panel className="p-5">
          <h2 className="text-sm font-semibold">Unattributed activity</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {unattributedEntries.length} logged {unattributedEntries.length === 1 ? "entry" : "entries"} with no
            competitor identified, most deals lost and most churn never name who won instead. This still counts
            toward the reasons above; it just can&rsquo;t move one specific competitor&rsquo;s Momentum score.
          </p>
          {correlationNote ? (
            <p className="mt-3 rounded-md border border-amber-500/25 bg-amber-500/[0.06] px-2.5 py-1.5 text-xs text-foreground">
              {correlationNote}
            </p>
          ) : null}
        </Panel>
      ) : null}

      {entries.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold">By competitor</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {competitors.map((c) => {
              const list = byCompetitor.get(c.id) ?? [];
              const won = list.filter((e) => e.outcome === "won").length;
              const lost = list.filter((e) => e.outcome === "lost").length;
              const churned = list.length - won - lost;
              return (
                <Link
                  key={c.id}
                  href={`/app/competitors/${c.id}#fact-sheet`}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-border/80 hover:bg-secondary/30"
                >
                  <CardHead
                    avatar={<CardAvatar seed={c.name} />}
                    title={c.name}
                    eyebrow={
                      list.length === 0 ? (
                        "Nothing logged yet"
                      ) : (
                        <>
                          <span className="font-semibold text-primary">{won} won</span> ·{" "}
                          <span className="font-semibold text-amber-600 dark:text-amber-400">{lost} lost</span>
                          {churned > 0 ? (
                            <>
                              {" "}
                              · <span className="font-semibold text-rose-600 dark:text-rose-400">{churned} churned</span>
                            </>
                          ) : null}
                        </>
                      )
                    }
                  />
                  <CardFoot>
                    <span />
                    <span>View fact sheet →</span>
                  </CardFoot>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
