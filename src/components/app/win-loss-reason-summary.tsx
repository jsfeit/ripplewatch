"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WinLossOutcome } from "@/lib/supabase/types";

export type WinLossEntry = { id: string; outcome: WinLossOutcome; reason: string | null; created_at: string };

const TOP_N = 5;

// Shared by the per-competitor fact sheet and the account-wide Win/Loss
// page so both read the same way — a raw dump of hundreds of CSV rows is
// unreadable, and most reasons repeat verbatim (a CRM's own canned-reason
// dropdown, in practice). Grouped by exact reason text (case/whitespace-
// insensitive) rather than an LLM call: deterministic, free, and this data
// is close-ended enough that exact matching does the job — fuzzy synthesis
// across genuinely freeform text is what Trends is already for.
export function WinLossReasonSummary({
  entries,
  subjectLabel,
  onDeleteEntry,
}: {
  entries: WinLossEntry[];
  // e.g. "against Xero" (fact sheet) or "across all competitors" (Win/Loss
  // page) — appended after the won/lost tally.
  subjectLabel: string;
  // Omitted on the Win/Loss page's per-competitor cards, where deleting an
  // entry means navigating to that competitor's own fact sheet instead —
  // avoids a delete control that's easy to misclick from a summary view.
  onDeleteEntry?: (id: string) => void;
}) {
  const [showAllEntries, setShowAllEntries] = useState(false);

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
  // win reason but shows up a couple times on the loss side (or vice
  // versa) can legitimately appear in both.
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

  if (entries.length === 0) return null;

  return (
    <div>
      <p className="text-[11px] text-muted-foreground">
        <span className="font-semibold text-primary">{wonTotal} won</span> ·{" "}
        <span className="font-semibold text-amber-600 dark:text-amber-400">{lostTotal} lost</span> {subjectLabel}
      </p>

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
                  <span className="shrink-0 font-semibold text-amber-600 dark:text-amber-400">{g.lostCount}</span>
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
              {onDeleteEntry ? (
                <button
                  type="button"
                  onClick={() => onDeleteEntry(e.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Delete entry"
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
