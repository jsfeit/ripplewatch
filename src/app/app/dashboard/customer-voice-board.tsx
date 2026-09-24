"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, Plus, Upload, TrendingUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/app/empty-state";
import { cn } from "@/lib/utils";
import { summarizeNps, npsBucket, NPS_WINDOW_DAYS, type NpsBucket } from "@/lib/customer-voice";
import type { Database, CustomerFeedbackStatus } from "@/lib/supabase/types";

type FeedbackRow = Pick<
  Database["public"]["Tables"]["account_customer_feedback"]["Row"],
  "id" | "summary" | "score" | "respondent" | "source" | "status" | "feedback_date" | "origin" | "created_at"
>;

const BUCKET_STYLES: Record<NpsBucket, string> = {
  promoter: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  passive: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  detractor: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

const STATUS_LABELS: Record<CustomerFeedbackStatus, string> = {
  new: "New",
  considering: "Considering",
  planned: "Planned",
  shipped: "Shipped",
  declined: "Declined",
};

const STATUS_STYLES: Record<CustomerFeedbackStatus, string> = {
  new: "bg-secondary text-muted-foreground",
  considering: "bg-chart-3/15 text-chart-3",
  planned: "bg-primary/10 text-primary",
  shipped: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  declined: "bg-muted text-muted-foreground/60",
};

const ALL_STATUSES: CustomerFeedbackStatus[] = ["new", "considering", "planned", "shipped", "declined"];

// One consolidated log — NPS is just one shape a customer-feedback entry
// can take (a score attached to it), not a parallel system next to "what
// customers are asking for." Modeled directly on Win/loss: one form, one
// CSV import, one list, an optional field distinguishing the shapes rather
// than two separate tables/panels. Folded by default for an account with
// nothing logged yet.
export function CustomerVoiceBoard({ initialEntries }: { initialEntries: FeedbackRow[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const summary = useMemo(() => summarizeNps(entries), [entries]);
  const [expanded, setExpanded] = useState(initialEntries.length > 0);

  const [formOpen, setFormOpen] = useState(false);
  const [hasScore, setHasScore] = useState(false);
  const [score, setScore] = useState("9");
  const [entrySummary, setEntrySummary] = useState("");
  const [respondent, setRespondent] = useState("");
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  async function addEntry() {
    if (!entrySummary.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/customer-voice/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: entrySummary.trim(),
          score: hasScore ? Number(score) : undefined,
          respondent: respondent.trim() || undefined,
          source: source.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setEntries((prev) => [data.entry, ...prev]);
      setEntrySummary("");
      setRespondent("");
      setSource("");
      setHasScore(false);
      setScore("9");
      setFormOpen(false);
    } catch {
      // Left as-is so nothing typed is lost — the button just stops spinning.
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: CustomerFeedbackStatus) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
    await fetch(`/api/customer-voice/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => {});
  }

  async function deleteEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/customer-voice/feedback/${id}`, { method: "DELETE" }).catch(() => {});
  }

  async function handleCsv(file: File) {
    setUploading(true);
    setImportMessage(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/customer-voice/feedback/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setImportMessage(`Imported ${data.imported} entr${data.imported === 1 ? "y" : "ies"}.`);
      // A bulk insert doesn't hand back the created rows, and re-deriving
      // them client-side isn't worth a second round trip's complexity for
      // an action someone takes rarely — reload picks up the fresh
      // server-fetched list the same way any other page load does.
      window.location.reload();
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const hasAnyData = entries.length > 0;
  const scoredCount = entries.filter((e) => e.score !== null).length;
  const askCount = entries.length - scoredCount;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left hover:border-primary/40"
      >
        <span className="text-sm">
          {hasAnyData ? (
            <>
              <span className="font-semibold">{entries.length}</span> logged
              <span className="text-muted-foreground">
                {" · "}
                {scoredCount} with a score, {askCount} without
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">No customer voice data yet</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
          {expanded ? "Collapse" : "Show"}
          <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
        </span>
      </button>

      {expanded ? (
        <Panel className="mt-2.5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                <TrendingUp className="size-3.5" />
              </span>
              <h2 className="text-sm font-semibold">Customer voice</h2>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCsv(file);
                }}
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                Import CSV
              </Button>
              <Button size="sm" onClick={() => setFormOpen((v) => !v)}>
                <Plus className="size-3.5" />
                Log feedback
              </Button>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            What your own customers say — an NPS score, a feature request, a complaint. A score is optional: NPS
            is just one shape this can take, not a separate thing to track.
          </p>

          {importMessage ? <p className="mt-2 text-xs text-muted-foreground">{importMessage}</p> : null}

          {formOpen ? (
            <div className="mt-4 space-y-2 rounded-lg border border-border p-3">
              <Textarea
                value={entrySummary}
                onChange={(e) => setEntrySummary(e.target.value)}
                placeholder="What did they say? (a reason, a request, a complaint)"
                rows={2}
              />
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={hasScore} onChange={(e) => setHasScore(e.target.checked)} className="size-3.5" />
                  Has an NPS score
                </label>
                {hasScore ? (
                  <Select value={score} onValueChange={(v) => v && setScore(v)}>
                    <SelectTrigger className="w-20">
                      <SelectValue>{() => score}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 11 }).map((_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {i}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <Input
                  value={respondent}
                  onChange={(e) => setRespondent(e.target.value)}
                  placeholder="Who (optional)"
                  className="min-w-[140px] flex-1"
                />
                <Input
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Where from (optional)"
                  className="min-w-[140px] flex-1"
                />
              </div>
              <div className="flex justify-end gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={addEntry} disabled={saving || !entrySummary.trim()}>
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </div>
          ) : null}

          {entries.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={TrendingUp}
                title="No customer voice data yet"
                description="Log a score, a request, or import a CSV export from your survey or support tool to start tracking what your own customers think."
              />
            </div>
          ) : (
            <>
              {summary.overallCount > 0 ? (
                <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 border-b border-dashed border-border pb-4">
                  <div>
                    <p className="text-3xl font-bold tabular-nums">{summary.overallScore}</p>
                    <p className="text-xs text-muted-foreground">
                      NPS · {summary.overallCount} scored response{summary.overallCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  {summary.recentScore !== null ? (
                    <p className="text-xs text-muted-foreground">
                      Last {NPS_WINDOW_DAYS} days: <span className="font-medium text-foreground">{summary.recentScore}</span>
                      {summary.priorScore !== null ? ` (was ${summary.priorScore})` : ""}
                    </p>
                  ) : null}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="size-2 rounded-full bg-emerald-500" /> {summary.promoters} promoters
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="size-2 rounded-full bg-amber-500" /> {summary.passives} passive
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="size-2 rounded-full bg-rose-500" /> {summary.detractors} detractors
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 space-y-2">
                {entries.slice(0, 30).map((e) => (
                  <div key={e.id} className="flex items-start gap-3 rounded-lg border border-border p-2.5 text-sm">
                    {e.score !== null ? (
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                          BUCKET_STYLES[npsBucket(e.score)]
                        )}
                      >
                        {e.score}
                      </span>
                    ) : (
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-muted-foreground">
                        —
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground">{e.summary}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {e.respondent ? <span className="font-medium text-foreground">{e.respondent}</span> : null}
                        {e.source ? <span>{e.source}</span> : null}
                        <span>{new Date(e.feedback_date).toLocaleDateString()}</span>
                        {e.origin === "csv_import" ? (
                          <span className="rounded-full bg-secondary px-1.5 py-0.5">Imported</span>
                        ) : null}
                      </div>
                    </div>
                    <Select value={e.status} onValueChange={(v) => v && updateStatus(e.id, v as CustomerFeedbackStatus)}>
                      <SelectTrigger className="w-auto shrink-0">
                        <SelectValue>
                          {() => (
                            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[e.status])}>
                              {STATUS_LABELS[e.status]}
                            </span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon-sm" onClick={() => deleteEntry(e.id)} aria-label="Delete entry">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
                {entries.length > 30 ? (
                  <p className="text-xs text-muted-foreground">Showing the 30 most recent of {entries.length}.</p>
                ) : null}
              </div>
            </>
          )}
        </Panel>
      ) : null}
    </div>
  );
}
