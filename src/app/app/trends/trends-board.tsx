"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Printer, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/app/empty-state";
import { cn } from "@/lib/utils";
import { SIGNAL_TYPE_LABELS } from "@/lib/mock-data";
import type { Database } from "@/lib/supabase/types";

type Trend = Database["public"]["Tables"]["win_loss_trends"]["Row"];
type SignalSummary = Pick<
  Database["public"]["Tables"]["signals"]["Row"],
  "id" | "title" | "url" | "type" | "occurred_on"
>;

export function TrendsBoard({
  accountName,
  initialTrends,
  initialGeneratedAt,
  signalsById,
}: {
  accountName: string;
  initialTrends: Trend[];
  initialGeneratedAt: string | null;
  signalsById: Record<string, SignalSummary>;
}) {
  const [trends, setTrends] = useState(initialTrends);
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [insufficientData, setInsufficientData] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    setInsufficientData(false);
    try {
      const res = await fetch("/api/trends/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not generate trends.");
        return;
      }
      if (data.insufficientData) {
        setInsufficientData(true);
        return;
      }
      setTrends(
        data.trends.map((t: { theme: string; summary: string; wonCount: number; lostCount: number; exampleReasons: string[]; relatedSignals: { signalId: string; relationNote: string }[] }, i: number) => ({
          id: `pending-${i}`,
          account_id: "",
          theme: t.theme,
          summary: t.summary,
          won_count: t.wonCount,
          lost_count: t.lostCount,
          example_reasons: t.exampleReasons,
          related_signals: t.relatedSignals,
          generated_at: data.generatedAt,
          created_at: data.generatedAt,
        }))
      );
      setGeneratedAt(data.generatedAt);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      {/* Print-only header — the interactive controls below (Generate,
          status text) are hidden on print, so the exported page needs its
          own plain-text context instead of the app chrome. */}
      <div className="hidden print:block">
        <h2 className="text-lg font-semibold">{accountName}: Win/Loss trends</h2>
        {generatedAt ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Generated {new Date(generatedAt).toLocaleDateString()}
          </p>
        ) : null}
      </div>

      <Panel className="flex flex-wrap items-center justify-between gap-3 p-4 print:hidden">
        <div>
          <p className="text-sm font-medium">
            {generatedAt ? `Generated ${new Date(generatedAt).toLocaleDateString()}` : "Not generated yet"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Looks across every logged win/loss reason for recurring themes. Runs when you click Generate rather
            than automatically, so it always reflects your latest data.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {trends.length > 0 ? (
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="size-3.5" />
              Print
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            {generatedAt ? "Refresh" : "Generate"}
          </Button>
        </div>
      </Panel>

      {error ? <p className="mt-3 text-sm text-destructive print:hidden">{error}</p> : null}
      {insufficientData ? (
        <p className="mt-3 text-sm text-muted-foreground print:hidden">
          Not enough logged win/loss or churn data yet to identify real trends.{" "}
          <Link href="/app/dashboard#win-loss" className="text-primary underline underline-offset-2">
            Log or import more in the Win/loss section
          </Link>
          , then try again.
        </p>
      ) : null}

      {trends.length === 0 && !insufficientData ? (
        <div className="mt-6 print:hidden">
          <EmptyState
            icon={TrendingUp}
            title="No trends yet"
            description="Click Generate to see the patterns behind why you're winning and losing deals."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {trends.map((trend) => (
            <TrendCard key={trend.id} trend={trend} signalsById={signalsById} />
          ))}
        </div>
      )}
    </div>
  );
}

function TrendCard({ trend, signalsById }: { trend: Trend; signalsById: Record<string, SignalSummary> }) {
  const total = trend.won_count + trend.lost_count;
  const wonPct = total > 0 ? Math.round((trend.won_count / total) * 100) : 0;

  return (
    <Panel className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{trend.theme}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{trend.summary}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
            {trend.won_count} won
          </span>
          <span className="rounded-full bg-rose-500/10 px-2 py-0.5 font-semibold text-rose-600 dark:text-rose-400">
            {trend.lost_count} lost
          </span>
        </div>
      </div>

      {total > 0 ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-rose-500/20">
          <div className="h-full bg-emerald-500" style={{ width: `${wonPct}%` }} />
        </div>
      ) : null}

      {trend.example_reasons.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {trend.example_reasons.map((reason, i) => (
            <li key={i} className="before:mr-1 before:text-primary before:content-['‣']">
              {reason}
            </li>
          ))}
        </ul>
      ) : null}

      {(() => {
        const linked = trend.related_signals
          .map((related) => ({ related, signal: signalsById[related.signalId] }))
          .filter((r) => r.signal);
        return (
          <div className="mt-3 space-y-1.5 border-t border-dashed border-border pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Why it&apos;s happening
            </p>
            {linked.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">
                No specific news or activity from a competitor explains this yet, just a pattern in what you&apos;ve
                logged.
              </p>
            ) : (
              linked.map(({ related, signal }, i) => (
                <div key={i} className="text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                      )}
                    >
                      {SIGNAL_TYPE_LABELS[signal!.type] ?? signal!.type}
                    </span>
                    {signal!.url ? (
                      <a
                        href={signal!.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline"
                      >
                        {signal!.title}
                      </a>
                    ) : (
                      <span className="font-medium">{signal!.title}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-muted-foreground">{related.relationNote}</p>
                </div>
              ))
            )}
          </div>
        );
      })()}
    </Panel>
  );
}
