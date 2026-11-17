"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CopyPromptButton } from "@/components/app/copy-prompt-button";
import { ATTACH_PROMPT, isTooDetailed, periodChurn, TOO_DETAILED_MESSAGE, type MetricPeriod, type MetricsRead } from "@/lib/customer-metrics";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 100_000;

// What the server adds once numbers are saved: whether churn started rising near a competitor's move,
// and how it sits against a published range. Both arrive behind the scenes; nothing here asks for more.
type Insight = {
  timing: { sentence: string } | null;
  comparison: { sentence: string } | null;
  benchmark: { sourceName: string; sourceUrl: string } | null;
  marketGrowth: { direction: string; reason: string | null } | null;
};
const MARKET_WORDS: Record<string, string> = { heating_up: "heating up", steady: "steady", cooling: "cooling off" };
const pickInsight = (d: Partial<Insight>): Insight => ({
  timing: d.timing ?? null,
  comparison: d.comparison ?? null,
  benchmark: d.benchmark ?? null,
  marketGrowth: d.marketGrowth ?? null,
});

function monthLabel(periodStart: string): string {
  return new Date(`${periodStart}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

const SURVEY_PROMPT = (names: string[]) =>
  `Draft a cancellation survey for my company using Ripplewatch. Three questions, under 30 seconds, plain language. Offer my tracked competitors${names.length > 0 ? ` (${names.join(", ")})` : ""} as answers, and include "I use both" and "I'm not switching". Tell me where to put it, and I'll place it myself. When answers come in, count them by answer and log the totals to Ripplewatch.`;

// Churn for a consumer company, in one box. Paste a table, type it in plain words, or upload a file:
// Ripplewatch reads the months it can find and saves them, and anything that isn't numbers is kept as
// a note about customers. Most consumer companies can't say why each customer left, but they know
// their churn, so that is what this takes.
export function ChurnDataCard({
  segment = "consumer",
  onSaved,
  onNote,
  fallback = false,
}: {
  // The lean version shown under "Can't use your assistant right now": just the box, no upload and no
  // pointers to the assistant, since the screen above already says that.
  fallback?: boolean;
  segment?: "business" | "consumer";
  onSaved?: () => void;
  // Called when what was written has no months in it, so it is kept as a note about customers instead.
  onNote?: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [periods, setPeriods] = useState<MetricPeriod[] | null>(null);
  const [read, setRead] = useState<MetricsRead | null>(null);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [keptAsNote, setKeptAsNote] = useState(false);
  // Too long, or a row per customer: sent to the customer's own assistant, which can count properly.
  const [tooMuch, setTooMuch] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Show what is already saved, so coming back here shows the read instead of an empty box.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/connect/metrics?segment=${segment}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.read) return;
        setPeriods(data.periods as MetricPeriod[]);
        setRead(data.read as MetricsRead);
        setInsight(pickInsight(data));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [segment]);

  // Reads the months out of whatever was given, and saves them. The same months sent again replace
  // the earlier ones, so reading it again after a fix is safe.
  async function submit(source: string) {
    if (source.trim().length < 8) return;
    setError("");
    setKeptAsNote(false);
    setTooMuch(false);
    if (isTooDetailed(source)) {
      setTooMuch(true);
      return;
    }
    setBusy(true);
    try {
      const preview = await fetch("/api/connect/metrics/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: source }),
      });
      const found = await preview.json().catch(() => ({}));
      if (preview.status === 422 && found.code === "use_assistant") {
        setTooMuch(true);
        return;
      }
      if (preview.status === 422) {
        // No months in it: keep it as a note about customers instead of rejecting it, where there is
        // somewhere to keep it. Otherwise say so rather than pretend it was saved.
        if (onNote) {
          onNote(source.trim());
          setKeptAsNote(true);
        } else {
          setError("I couldn't find months in that. Add a month with either the churn rate or the customers who cancelled.");
        }
        return;
      }
      if (!preview.ok) {
        setError(found.error ?? "I couldn't read that. Try again.");
        return;
      }
      const save = await fetch("/api/connect/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periods: found.periods, segment }),
      });
      const saved = await save.json().catch(() => ({}));
      if (!save.ok) {
        setError(saved.error ?? "Could not save that.");
        return;
      }
      setPeriods(saved.periods ?? found.periods);
      setRead(saved.read ?? found.read);
      setInsight(pickInsight(saved));
      onSaved?.();
    } catch {
      setError("I couldn't reach Ripplewatch. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError("");
      setKeptAsNote(false);
      setTooMuch(true);
      return;
    }
    const content = await file.text();
    setText(content);
    await submit(content);
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="max-h-44 overflow-y-auto"
        maxLength={20000}
        aria-label="Your churn, in your own words or as a table"
        placeholder={"Churn was 4.8% in September and 6.2% in October.\nOr paste a table from your billing tool, any layout."}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => void submit(text)} disabled={busy || text.trim().length < 8}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Read it
        </Button>
        {fallback ? null : (
          <>
        <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Upload className="size-3.5" />
          Upload a CSV
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/plain"
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
          </>
        )}
        <span className="text-xs text-muted-foreground">Include the months. A few is enough.</span>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {tooMuch ? (
        <div role="alert" className="space-y-2 rounded-md border border-border bg-secondary/30 p-3">
          <p className="text-sm">{TOO_DETAILED_MESSAGE}</p>
          <CopyPromptButton text={ATTACH_PROMPT} label="Copy the prompt" />
        </div>
      ) : null}
      {keptAsNote ? (
        <p className="flex items-center gap-1.5 text-sm text-primary">
          <Check className="size-4" />
          Got it. I&apos;ll add that to what I know about your customers. Add months too if you have them.
        </p>
      ) : null}

      {read && periods ? (
        <div className="space-y-2 rounded-md border border-primary/30 bg-primary/[0.04] p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            <Check className="size-4" />
            Read and saved
            <span
              className={cn(
                "ml-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                read.confidence === "low" ? "border-border text-muted-foreground" : "border-primary/40 text-primary"
              )}
            >
              {read.confidence === "low" ? "Early lead" : "Fair confidence"}
            </span>
          </p>
          <p className="text-sm">{read.headline}</p>
          {insight?.timing ? <p className="text-sm">{insight.timing.sentence}</p> : null}
          {insight?.comparison ? (
            <p className="text-sm">
              {insight.comparison.sentence}{" "}
              {insight.benchmark ? (
                <a href={insight.benchmark.sourceUrl} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">
                  Source
                </a>
              ) : null}
            </p>
          ) : null}
          {insight?.marketGrowth ? (
            <p className="text-sm text-muted-foreground">
              Your market is {MARKET_WORDS[insight.marketGrowth.direction] ?? "moving"} overall
              {insight.marketGrowth.reason ? `: ${insight.marketGrowth.reason.replace(/\.$/, "")}.` : "."}
            </p>
          ) : null}
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">
              See the {periods.length} month{periods.length === 1 ? "" : "s"} I read
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left tabular-nums">
                <thead>
                  <tr>
                    <th className="py-1 pr-3 font-medium">Month</th>
                    <th className="py-1 pr-3 font-medium">Churn</th>
                    <th className="py-1 pr-3 font-medium">Customers</th>
                    <th className="py-1 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => {
                    const churn = periodChurn(p);
                    return (
                      <tr key={p.periodStart} className="border-t border-border/60">
                        <td className="py-1 pr-3">{monthLabel(p.periodStart)}</td>
                        <td className="py-1 pr-3">{churn === null ? "-" : `${Math.round(churn * 10) / 10}%`}</td>
                        <td className="py-1 pr-3">{p.customersStart === null ? "-" : p.customersStart.toLocaleString("en-US")}</td>
                        <td className="py-1">{p.revenue === null ? "-" : p.revenue.toLocaleString("en-US")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-2">Not right? Fix the text and read it again. Months with the same date are replaced.</p>
            </div>
          </details>
          <p className="text-xs text-muted-foreground">
            I&apos;ll keep lining this up against competitor moves and a typical range for your kind of product. Nothing else to do here.
          </p>
        </div>
      ) : null}

      {fallback ? null : (
        <>
      {tooMuch ? null : (
        <>
          <p className="text-xs text-muted-foreground">
            Have a big export or a list of customers? Attach it in Claude or ChatGPT instead: it can count the rows properly, then add the
            months here. It can pull from Stripe, Shopify or Intercom too, so there&apos;s nothing to connect.
          </p>
          <div className="flex flex-wrap gap-2">
            <CopyPromptButton text={ATTACH_PROMPT} label="Copy a prompt for it" />
          </div>
        </>
      )}

        </>
      )}
    </div>
  );
}

// "Not sure why people leave?" The survey prompt, as a collapsed row that opens by itself when churn is
// rising. Your numbers show when churn moved; only customers can say why, and whether they also use a
// competitor. Ripplewatch doesn't host or send the survey.
export function SurveyPromptRow({ competitorNames, rising }: { competitorNames: string[]; rising: boolean }) {
  const names = competitorNames.filter(Boolean);
  return (
    <details open={rising} className="rounded-md border border-border p-3">
      <summary className="cursor-pointer select-none text-sm font-medium">
        {rising ? "Churn is rising. Ask people why." : "Not sure why people leave?"}
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">
        Your numbers show when churn moved. Only your customers can say why, and whether they also use a competitor. This prompt has your
        assistant draft a short cancellation survey for you to place. Ripplewatch doesn&apos;t host it.
      </p>
      <div className="mt-2">
        <CopyPromptButton text={SURVEY_PROMPT(names)} label="Copy the survey prompt" />
      </div>
    </details>
  );
}
