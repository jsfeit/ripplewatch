"use client";

import { useState } from "react";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Panel } from "@/components/ui/panel";
import type { DealCoverage } from "@/lib/deal-coverage";
import type { ImpactFinding } from "@/lib/deal-llm";

export type DealNote = {
  id: string;
  body: string;
  kind: string;
  status: string | null;
  product_areas: string[];
  effective_on: string;
  expected_on: string | null;
};

const LEVEL_LABEL: Record<DealCoverage["level"], string> = {
  none: "No deal history yet",
  thin: "Just getting started",
  building: "Patterns forming",
  solid: "Enough to see trends",
};

const LEVEL_STEP: Record<DealCoverage["level"], number> = { none: 0, thin: 1, building: 2, solid: 3 };

const CONFIDENCE_STYLE: Record<ImpactFinding["confidence"], string> = {
  high: "bg-primary/10 text-primary",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  low: "bg-secondary text-muted-foreground",
};

// What is costing deals, how much history backs it, and the team's own notes, in one place. The
// history meter is deliberate: more deals and more months visibly sharpen the answer.
export type DealIntelligenceProps = {
  initialCoverage: DealCoverage;
  initialFindings: ImpactFinding[];
  initialGeneratedAt: string | null;
  initialNotes: DealNote[];
};

export function DealIntelligencePanel({ initialCoverage, initialFindings, initialGeneratedAt, initialNotes }: DealIntelligenceProps) {
  const [coverage, setCoverage] = useState(initialCoverage);
  const [findings, setFindings] = useState(initialFindings);
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  async function runImpact(refresh: boolean) {
    setLoading(true);
    setNote(null);
    try {
      const res = await fetch("/api/deal-impact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not build that.");
      setCoverage(data.coverage);
      setFindings(data.findings ?? []);
      setGeneratedAt(data.generatedAt ?? null);
      setNote(data.note ?? null);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not build that.");
    } finally {
      setLoading(false);
    }
  }

  async function addNote() {
    if (!draft.trim()) return;
    setSaving(true);
    setNoteError(null);
    try {
      const res = await fetch("/api/context-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save that.");
      setNotes((prev) => [data.note as DealNote, ...prev]);
      setDraft("");
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "Could not save that.");
    } finally {
      setSaving(false);
    }
  }

  async function removeNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/context-notes/${id}`, { method: "DELETE" }).catch(() => undefined);
  }

  const step = LEVEL_STEP[coverage.level];

  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">What&rsquo;s costing you deals</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Why you lose, how that is changing, and which competitor moves line up with it, checked against what you are building.
            </p>
          </div>
          <Button size="sm" onClick={() => runImpact(findings.length > 0)} disabled={loading || coverage.dealCount === 0}>
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {findings.length > 0 ? "Refresh" : "Read my deals"}
          </Button>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{LEVEL_LABEL[coverage.level]}</span>
            <span className="tabular-nums text-muted-foreground">
              {coverage.dealCount.toLocaleString()} deals{coverage.monthsSpan >= 1 ? ` · ${Math.round(coverage.monthsSpan)} months` : ""}
            </span>
          </div>
          <div className="mt-1.5 flex gap-1" aria-hidden>
            {[1, 2, 3].map((i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-secondary"}`} />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{coverage.message}</p>
        </div>

        {note ? <p className="mt-3 rounded-md border border-border bg-secondary/40 px-2.5 py-1.5 text-xs">{note}</p> : null}

        {findings.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {findings.map((f, i) => (
              <li key={i} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{f.headline}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${CONFIDENCE_STYLE[f.confidence]}`}>
                    {f.confidence} confidence
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{f.explanation}</p>
                {f.evidence.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                    {f.evidence.map((e, j) => (
                      <li key={j}>{e}</li>
                    ))}
                  </ul>
                ) : null}
                {f.action ? (
                  <p className="mt-2 text-xs">
                    <span className="font-semibold text-foreground">Next: </span>
                    {f.action}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {generatedAt ? (
          <p className="mt-3 text-[11px] text-muted-foreground">Last read {new Date(generatedAt).toLocaleDateString()}.</p>
        ) : null}
      </Panel>

      <Panel className="p-5">
        <h3 className="text-sm font-semibold">What you&rsquo;re building, and what you hear</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Write anything, in your own words: what ships when, a pricing change, something a customer keeps saying, a
          sales-call insight. I line it up against why you lose deals and what competitors are doing.
        </p>
        <Textarea
          className="mt-3"
          rows={3}
          placeholder="e.g. We're shipping reporting dashboards in mid-December. Three prospects this quarter said SSO was a must-have."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          {noteError ? <p className="text-xs text-destructive">{noteError}</p> : <span />}
          <Button size="sm" onClick={addNote} disabled={saving || !draft.trim()}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Add note
          </Button>
        </div>
        {notes.length > 0 ? (
          <ul className="mt-3 divide-y divide-border">
            {notes.slice(0, 8).map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs">{n.body}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {n.effective_on} · {n.kind}
                    {n.status ? ` · ${n.status.replace("_", " ")}` : ""}
                    {n.expected_on ? ` · ${n.expected_on}` : ""}
                    {n.product_areas.length > 0 ? ` · ${n.product_areas.join(", ")}` : ""}
                  </p>
                </div>
                <button type="button" onClick={() => removeNote(n.id)} aria-label="Delete note" className="mt-0.5 text-muted-foreground hover:text-foreground">
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
    </div>
  );
}
