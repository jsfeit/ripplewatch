"use client";

import { useState } from "react";
import { Loader2, Plus, Printer, RefreshCw, Trash2, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { WinLossOutcome } from "@/lib/supabase/types";

type WinLossEntry = {
  id: string;
  outcome: WinLossOutcome;
  reason: string;
  created_at: string;
};

// Bullets are cached on the competitor row as newline-joined text (see the
// fact-sheet API route) rather than jsonb — split back into a list here,
// dropping any blank lines.
function toBullets(text: string | null): string[] {
  return (text ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
}

export function CompetitorFactSheet({
  competitorId,
  initialWhyWeWin,
  initialWhyWeLose,
  initialGeneratedAt,
  initialWinLoss,
}: {
  competitorId: string;
  initialWhyWeWin: string | null;
  initialWhyWeLose: string | null;
  initialGeneratedAt: string | null;
  initialWinLoss: WinLossEntry[];
}) {
  const [whyWeWin, setWhyWeWin] = useState(toBullets(initialWhyWeWin));
  const [whyWeLose, setWhyWeLose] = useState(toBullets(initialWhyWeLose));
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const [entries, setEntries] = useState(initialWinLoss);
  const [formOpen, setFormOpen] = useState(false);
  const [outcome, setOutcome] = useState<WinLossOutcome>("lost");
  const [reason, setReason] = useState("");
  const [savingEntry, setSavingEntry] = useState(false);

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
      setGenError("Couldn't generate the fact sheet — try again.");
    } finally {
      setGenerating(false);
    }
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

  return (
    <div className="mt-8 rounded-lg border border-border p-4 print:border-none print:p-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground print:text-base print:text-foreground">
            Fact sheet
          </h2>
          <p className="mt-1 text-xs text-muted-foreground print:hidden">
            For your team, not for prospects — grounded only in logged wins/losses, real signals, and researched
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
          <Button variant="outline" size="sm" onClick={generate} disabled={generating}>
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
          Not generated yet — click Generate to build it from this competitor&apos;s signals, pricing, and any logged
          wins/losses below.
        </p>
      )}

      <div className="mt-6 border-t border-border pt-4 print:hidden">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-muted-foreground">Win/loss log</p>
          <Button variant="ghost" size="sm" onClick={() => setFormOpen((v) => !v)}>
            <Plus className="size-3.5" />
            Log a win/loss
          </Button>
        </div>

        {entries.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            No wins or losses logged yet against this competitor. The more you log, the sharper and more specific
            this fact sheet gets — especially the &quot;why we win&quot; side, which is thin without real evidence.
          </p>
        ) : (
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
                <span className="flex-1 text-foreground">{e.reason}</span>
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
                  ? "e.g. Lost this deal — they were $30/mo cheaper on the entry tier"
                  : "e.g. Won this deal — they don't offer our SSO integration"
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
    </div>
  );
}
