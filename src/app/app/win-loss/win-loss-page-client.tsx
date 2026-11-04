"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Panel } from "@/components/ui/panel";
import { CardAvatar, CardFoot, CardHead } from "@/components/app/card";
import { WinLossReasonSummary, type WinLossEntry } from "@/components/app/win-loss-reason-summary";
import { createClient } from "@/lib/supabase/client";
import type { WinLossOutcome } from "@/lib/supabase/types";
import { formatWinLossImportMessage, type ImportMessageData } from "@/lib/win-loss-import";
import { DealImportReview } from "@/components/app/deal-import-review";
import type { DealImportPreview, DealImportSummary } from "@/lib/deal-ingest";
import { splitCsvIntoBatches } from "@/lib/csv-split";
import type { DealCoverage } from "@/lib/deal-coverage";
import { DealDataGuide } from "@/components/app/deal-data-guide";

// Columns are worked out from the first rows; the full file is then sent in batches that fit one request.
const PREVIEW_ROWS = 1500;
const COMMIT_ROWS = 1000;

type Competitor = { id: string; name: string };
type AccountEntry = WinLossEntry & { competitor_id: string };

// Sentinel for "don't know who we lost to / where they churned to" — a
// real competitor_id is a uuid, so this can't collide with one. Kept as a
// plain string (not null) because Base UI's Select needs a non-empty value
// for every item.
const UNKNOWN_COMPETITOR = "unknown";

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
  // A file that has been read but not yet saved: the user checks the column mapping first.
  const [pending, setPending] = useState<{ text: string; filename: string; totalRows: number; preview: DealImportPreview } | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);

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
    setPending(null);
    try {
      const text = await file.text();
      // The columns are worked out from the start of the file; the whole file is imported on confirm.
      const { totalRows, batches } = splitCsvIntoBatches(text, PREVIEW_ROWS);
      if (batches.length === 0) throw new Error("That file looks empty.");
      const res = await fetch("/api/win-loss/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: batches[0] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not read that file.");
      setPending({ text, filename: file.name, totalRows, preview: data as DealImportPreview });
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : "Could not read that file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // The user changed a column: re-read the file with it so the numbers shown stay true.
  async function remapPending(mapping: DealImportPreview["mapping"]) {
    if (!pending) return;
    setPending({ ...pending, preview: { ...pending.preview, mapping } });
    try {
      const res = await fetch("/api/win-loss/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: splitCsvIntoBatches(pending.text, PREVIEW_ROWS).batches[0], mapping }),
      });
      const data = await res.json();
      if (res.ok) setPending((p) => (p ? { ...p, preview: data as DealImportPreview } : p));
    } catch {
      // Keep showing the previous numbers; confirming still uses the chosen mapping.
    }
  }

  async function confirmPending() {
    if (!pending) return;
    setCommitting(true);
    try {
      const { totalRows, batches } = splitCsvIntoBatches(pending.text, COMMIT_ROWS);
      const total: DealImportSummary = {
        totalExtracted: 0,
        imported: 0,
        skipped: 0,
        generalReasonsAdded: 0,
        generalReasonsSkipped: 0,
        generalWonReasonsAdded: 0,
        generalWonReasonsSkipped: 0,
        suggestedCompetitors: [],
        untrackedAlreadySuggested: 0,
        rowsConsidered: totalRows,
        totalRows,
        truncated: false,
        updated: 0,
        datedPct: 0,
        coverage: undefined as unknown as DealCoverage,
        importId: null,
      };
      let dated = 0;
      for (let i = 0; i < batches.length; i++) {
        setProgress(batches.length > 1 ? `Importing deals ${i * COMMIT_ROWS + 1} to ${Math.min(totalRows, (i + 1) * COMMIT_ROWS)} of ${totalRows}...` : null);
        const res = await fetch("/api/win-loss/import/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: batches[i], mapping: pending.preview.mapping, filename: pending.filename }),
        });
        const data = (await res.json()) as DealImportSummary & { error?: string };
        if (!res.ok) throw new Error(`${data.error ?? "Import failed."}${i > 0 ? ` The first ${i * COMMIT_ROWS} deals were saved; uploading the file again picks up where it stopped.` : ""}`);
        total.totalExtracted += data.totalExtracted;
        total.imported += data.imported;
        total.skipped += data.skipped;
        total.updated += data.updated;
        total.generalReasonsAdded += data.generalReasonsAdded;
        total.generalReasonsSkipped += data.generalReasonsSkipped;
        total.generalWonReasonsAdded += data.generalWonReasonsAdded;
        total.generalWonReasonsSkipped += data.generalWonReasonsSkipped;
        total.suggestedCompetitors = [...new Set([...total.suggestedCompetitors, ...data.suggestedCompetitors])];
        total.untrackedAlreadySuggested = Math.max(total.untrackedAlreadySuggested, data.untrackedAlreadySuggested);
        total.coverage = data.coverage;
        dated += (data.datedPct / 100) * data.totalExtracted;
      }
      total.datedPct = total.totalExtracted === 0 ? 0 : Math.round((dated / total.totalExtracted) * 100);
      setImportMessage(`${formatWinLossImportMessage("CSV", total as ImportMessageData, false)} ${total.coverage.message ?? ""}`.trim());
      setPending(null);
      await refetchEntries();
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setProgress(null);
      setCommitting(false);
    }
  }

  async function handleHubspotSync() {
    setSyncing(true);
    setImportMessage(null);
    try {
      const res = await fetch("/api/competitors/win-loss/sync-hubspot", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed.");
      setImportMessage(formatWinLossImportMessage("HubSpot", data as ImportMessageData, false));
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

          <DealDataGuide />

          {uploading || syncing ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Reading your file...
            </p>
          ) : importMessage ? (
            <p className="mt-2 text-xs text-muted-foreground">{importMessage}</p>
          ) : null}

          {progress ? <p className="mt-2 text-xs text-muted-foreground">{progress}</p> : null}

          {pending ? (
            <DealImportReview
              preview={pending.preview}
              busy={committing}
              onChange={remapPending}
              onConfirm={confirmPending}
              onCancel={() => setPending(null)}
              fileRows={pending.totalRows}
            />
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
              No wins or losses logged yet. Upload a CSV in any layout (go back as far as you have, and keep the close date),
              sync HubSpot, or log one above. The more history, the sharper everything gets.
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
