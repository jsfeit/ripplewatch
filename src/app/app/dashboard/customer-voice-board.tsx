"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2, Plus, Upload, TrendingUp, MessageSquareText, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/app/empty-state";
import { cn } from "@/lib/utils";
import { summarizeNps, npsBucket, NPS_WINDOW_DAYS, type NpsBucket } from "@/lib/customer-voice";
import type { Database, CustomerAskStatus } from "@/lib/supabase/types";

type NpsResponseRow = Pick<
  Database["public"]["Tables"]["account_nps_responses"]["Row"],
  "id" | "score" | "reason" | "respondent" | "survey_date" | "source" | "created_at"
>;
type AskRow = Pick<Database["public"]["Tables"]["account_customer_asks"]["Row"], "id" | "summary" | "source" | "status" | "created_at">;

const BUCKET_STYLES: Record<NpsBucket, string> = {
  promoter: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  passive: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  detractor: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

const STATUS_LABELS: Record<CustomerAskStatus, string> = {
  new: "New",
  considering: "Considering",
  planned: "Planned",
  shipped: "Shipped",
  declined: "Declined",
};

const STATUS_STYLES: Record<CustomerAskStatus, string> = {
  new: "bg-secondary text-muted-foreground",
  considering: "bg-chart-3/15 text-chart-3",
  planned: "bg-primary/10 text-primary",
  shipped: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  declined: "bg-muted text-muted-foreground/60",
};

const ASK_STATUSES: CustomerAskStatus[] = ["new", "considering", "planned", "shipped", "declined"];

// The account's own customers, not Ripplewatch's — NPS scores and
// standalone asks/feature-requests the account has collected, given the
// same structured-log treatment Win/loss already has instead of living
// only in the free-text won/lost/churn notes blob. Sits next to Win/loss
// as its own dashboard section since it's the same kind of first-party
// input, not competitor-derived.
export function CustomerVoiceBoard({
  initialResponses,
  initialAsks,
}: {
  initialResponses: NpsResponseRow[];
  initialAsks: AskRow[];
}) {
  const [responses, setResponses] = useState(initialResponses);
  const [asks, setAsks] = useState(initialAsks);
  const summary = useMemo(() => summarizeNps(responses), [responses]);

  const [npsFormOpen, setNpsFormOpen] = useState(false);
  const [npsScore, setNpsScore] = useState("9");
  const [npsReason, setNpsReason] = useState("");
  const [npsRespondent, setNpsRespondent] = useState("");
  const [savingNps, setSavingNps] = useState(false);
  const npsFileInputRef = useRef<HTMLInputElement>(null);
  const [npsUploading, setNpsUploading] = useState(false);
  const [npsImportMessage, setNpsImportMessage] = useState<string | null>(null);

  const [askFormOpen, setAskFormOpen] = useState(false);
  const [askSummary, setAskSummary] = useState("");
  const [askSource, setAskSource] = useState("");
  const [savingAsk, setSavingAsk] = useState(false);
  const askFileInputRef = useRef<HTMLInputElement>(null);
  const [askUploading, setAskUploading] = useState(false);
  const [askImportMessage, setAskImportMessage] = useState<string | null>(null);

  async function addNpsResponse() {
    const score = Number(npsScore);
    if (!Number.isInteger(score) || score < 0 || score > 10) return;
    setSavingNps(true);
    try {
      const res = await fetch("/api/customer-voice/nps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, reason: npsReason.trim() || undefined, respondent: npsRespondent.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setResponses((prev) => [data.response, ...prev]);
      setNpsScore("9");
      setNpsReason("");
      setNpsRespondent("");
      setNpsFormOpen(false);
    } catch {
      // Left as-is so nothing typed is lost — the button just stops spinning.
    } finally {
      setSavingNps(false);
    }
  }

  async function deleteNpsResponse(id: string) {
    setResponses((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/customer-voice/nps/${id}`, { method: "DELETE" }).catch(() => {});
  }

  async function handleNpsCsv(file: File) {
    setNpsUploading(true);
    setNpsImportMessage(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/customer-voice/nps/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setNpsImportMessage(
        `Imported ${data.imported} response${data.imported === 1 ? "" : "s"}${data.skipped > 0 ? ` (${data.skipped} skipped — unreadable score)` : ""}.`
      );
      // A bulk insert doesn't hand back the created rows, and re-deriving
      // them client-side isn't worth a second round trip's complexity for
      // an action someone takes rarely — reload picks up the fresh
      // server-fetched list the same way any other page load does.
      window.location.reload();
    } catch (err) {
      setNpsImportMessage(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setNpsUploading(false);
      if (npsFileInputRef.current) npsFileInputRef.current.value = "";
    }
  }

  async function addAsk() {
    if (!askSummary.trim()) return;
    setSavingAsk(true);
    try {
      const res = await fetch("/api/customer-voice/asks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: askSummary.trim(), source: askSource.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setAsks((prev) => [data.ask, ...prev]);
      setAskSummary("");
      setAskSource("");
      setAskFormOpen(false);
    } catch {
      // Left as-is so nothing typed is lost.
    } finally {
      setSavingAsk(false);
    }
  }

  async function updateAskStatus(id: string, status: CustomerAskStatus) {
    setAsks((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    await fetch(`/api/customer-voice/asks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => {});
  }

  async function deleteAsk(id: string) {
    setAsks((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/customer-voice/asks/${id}`, { method: "DELETE" }).catch(() => {});
  }

  async function handleAsksCsv(file: File) {
    setAskUploading(true);
    setAskImportMessage(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/customer-voice/asks/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setAskImportMessage(`Imported ${data.imported} ask${data.imported === 1 ? "" : "s"}.`);
      window.location.reload();
    } catch (err) {
      setAskImportMessage(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setAskUploading(false);
      if (askFileInputRef.current) askFileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <Panel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <TrendingUp className="size-3.5" />
            </span>
            <h2 className="text-sm font-semibold">Customer NPS</h2>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              ref={npsFileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleNpsCsv(file);
              }}
            />
            <Button variant="outline" size="sm" onClick={() => npsFileInputRef.current?.click()} disabled={npsUploading}>
              {npsUploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              Import CSV
            </Button>
            <Button size="sm" onClick={() => setNpsFormOpen((v) => !v)}>
              <Plus className="size-3.5" />
              Log a score
            </Button>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Scores your own customers gave you — &quot;how likely to recommend&quot;, 0-10 — not anything about
          Ripplewatch itself.
        </p>

        {npsImportMessage ? <p className="mt-2 text-xs text-muted-foreground">{npsImportMessage}</p> : null}

        {npsFormOpen ? (
          <div className="mt-4 space-y-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap gap-2">
              <Select value={npsScore} onValueChange={(v) => v && setNpsScore(v)}>
                <SelectTrigger className="w-20">
                  <SelectValue>{() => npsScore}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 11 }).map((_, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={npsRespondent}
                onChange={(e) => setNpsRespondent(e.target.value)}
                placeholder="Who (optional)"
                className="min-w-[160px] flex-1"
              />
            </div>
            <Textarea
              value={npsReason}
              onChange={(e) => setNpsReason(e.target.value)}
              placeholder="Why that score? (optional)"
              rows={2}
            />
            <div className="flex justify-end gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setNpsFormOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={addNpsResponse} disabled={savingNps}>
                {savingNps ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        ) : null}

        {responses.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={MessageSquareText}
              title="No NPS data yet"
              description="Log a score or import a CSV export from your survey tool to start tracking your own customers' sentiment."
            />
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
              <div>
                <p className="text-3xl font-bold tabular-nums">{summary.overallScore}</p>
                <p className="text-xs text-muted-foreground">
                  NPS · {summary.overallCount} response{summary.overallCount === 1 ? "" : "s"}
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

            <div className="mt-4 space-y-2">
              {responses.slice(0, 20).map((r) => (
                <div key={r.id} className="flex items-start gap-3 rounded-lg border border-border p-2.5 text-sm">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                      BUCKET_STYLES[npsBucket(r.score)]
                    )}
                  >
                    {r.score}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {r.respondent ? <span className="font-medium text-foreground">{r.respondent}</span> : null}
                      <span>{new Date(r.survey_date).toLocaleDateString()}</span>
                      {r.source === "csv_import" ? (
                        <span className="rounded-full bg-secondary px-1.5 py-0.5">Imported</span>
                      ) : null}
                    </div>
                    {r.reason ? <p className="mt-0.5 text-foreground">{r.reason}</p> : null}
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => deleteNpsResponse(r.id)} aria-label="Delete response">
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
              {responses.length > 20 ? (
                <p className="text-xs text-muted-foreground">Showing the 20 most recent of {responses.length}.</p>
              ) : null}
            </div>
          </>
        )}
      </Panel>

      <Panel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Users className="size-3.5" />
            </span>
            <h2 className="text-sm font-semibold">What customers are asking for</h2>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              ref={askFileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAsksCsv(file);
              }}
            />
            <Button variant="outline" size="sm" onClick={() => askFileInputRef.current?.click()} disabled={askUploading}>
              {askUploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              Import CSV
            </Button>
            <Button size="sm" onClick={() => setAskFormOpen((v) => !v)}>
              <Plus className="size-3.5" />
              Log an ask
            </Button>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Feature requests and asks from your own customers — a sales call, a support ticket, a survey open-end —
          tracked as its own pipeline instead of scattered across notes.
        </p>

        {askImportMessage ? <p className="mt-2 text-xs text-muted-foreground">{askImportMessage}</p> : null}

        {askFormOpen ? (
          <div className="mt-4 space-y-2 rounded-lg border border-border p-3">
            <Textarea
              value={askSummary}
              onChange={(e) => setAskSummary(e.target.value)}
              placeholder="What did they ask for?"
              rows={2}
            />
            <Input
              value={askSource}
              onChange={(e) => setAskSource(e.target.value)}
              placeholder="Where'd this come from? (optional — sales call, support ticket, survey...)"
            />
            <div className="flex justify-end gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setAskFormOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={addAsk} disabled={savingAsk || !askSummary.trim()}>
                {savingAsk ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        ) : null}

        {asks.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={Users}
              title="Nothing logged yet"
              description="Log an ask or import a CSV to start tracking what your customers actually want."
            />
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {asks.map((ask) => (
              <div key={ask.id} className="flex items-start gap-3 rounded-lg border border-border p-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-foreground">{ask.summary}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {ask.source ? <span>{ask.source}</span> : null}
                    <span>{new Date(ask.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <Select value={ask.status} onValueChange={(v) => v && updateAskStatus(ask.id, v as CustomerAskStatus)}>
                  <SelectTrigger className="w-auto shrink-0">
                    <SelectValue>
                      {() => (
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[ask.status])}>
                          {STATUS_LABELS[ask.status]}
                        </span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ASK_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon-sm" onClick={() => deleteAsk(ask.id)} aria-label="Delete ask">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
