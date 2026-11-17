"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { analyzeMetrics, periodChurn, type MetricPeriod, type MetricsRead } from "@/lib/customer-metrics";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 200_000;

function monthLabel(periodStart: string): string {
  return new Date(`${periodStart}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function firstOfMonth(monthsAgo: number): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1));
  return d.toISOString().slice(0, 10);
}

const num = (v: number | null, suffix = "") => (v === null ? "-" : `${v.toLocaleString("en-US", { maximumFractionDigits: 1 })}${suffix}`);

function CopyPrompt({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: the prompt is still readable on screen.
    }
  }
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <button
        type="button"
        onClick={() => void copy()}
        className="mt-1 flex w-full items-center justify-between gap-3 rounded-md border border-border bg-secondary/30 px-3 py-2 text-left text-sm hover:border-primary/50"
      >
        <span>{text}</span>
        {copied ? <Check className="size-3.5 shrink-0 text-primary" /> : <Copy className="size-3.5 shrink-0 text-muted-foreground" />}
      </button>
    </div>
  );
}

// Churn and growth over time for a consumer company. Most can't say why each customer left, but they
// know their numbers, so this takes the numbers: pasted, uploaded, two quick figures, or pulled by the
// customer's own assistant from their billing tool. It reads them and says plainly how sure it is.
export function ChurnDataCard({
  competitorNames,
  segment = "consumer",
  onSaved,
}: {
  competitorNames: string[];
  segment?: "business" | "consumer";
  onSaved?: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"read" | "save" | null>(null);
  const [error, setError] = useState("");
  const [periods, setPeriods] = useState<MetricPeriod[] | null>(null);
  const [read, setRead] = useState<MetricsRead | null>(null);
  const [saved, setSaved] = useState(false);
  const [lastMonth, setLastMonth] = useState("");
  const [monthBefore, setMonthBefore] = useState("");
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
        setSaved(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [segment]);

  async function readIt(source: string) {
    setBusy("read");
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/connect/metrics/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: source }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "I couldn't read that. Try again.");
        return;
      }
      setPeriods(data.periods);
      setRead(data.read);
    } catch {
      setError("I couldn't reach Ripplewatch. Try again.");
    } finally {
      setBusy(null);
    }
  }

  function useTwoNumbers() {
    const a = Number(lastMonth);
    const b = Number(monthBefore);
    if (!Number.isFinite(a) || !Number.isFinite(b) || lastMonth.trim() === "" || monthBefore.trim() === "" || a < 0 || b < 0 || a > 100 || b > 100) {
      setError("Enter both as percentages between 0 and 100, like 6.2 and 4.8.");
      return;
    }
    const blank = { customersStart: null, newCustomers: null, cancelledCustomers: null, customersEnd: null, revenue: null };
    const next: MetricPeriod[] = [
      { periodStart: firstOfMonth(2), churnPct: b, ...blank },
      { periodStart: firstOfMonth(1), churnPct: a, ...blank },
    ];
    setError("");
    setSaved(false);
    setPeriods(next);
    setRead(analyzeMetrics(next));
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is too big. Paste just the monthly rows, or the last 12 to 24 months.");
      return;
    }
    const content = await file.text();
    setText(content);
    await readIt(content);
  }

  async function save() {
    if (!periods) return;
    setBusy("save");
    setError("");
    try {
      const res = await fetch("/api/connect/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periods, segment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save that.");
        return;
      }
      setSaved(true);
      onSaved?.();
    } catch {
      setError("I couldn't reach Ripplewatch. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const rising = read?.trend === "rising";
  const names = competitorNames.filter(Boolean);
  const pullPrompt =
    "From my billing tool, pull the last 12 months: customers at the start of each month, new customers, customers who cancelled, and revenue. Tell me what you read, then add it to Ripplewatch.";
  const surveyPrompt = `Draft a cancellation survey for my company using Ripplewatch. Three questions, under 30 seconds, plain language. Offer my tracked competitors${names.length > 0 ? ` (${names.join(", ")})` : ""} as answers, and include "I use both" and "I'm not switching". Tell me where to put it, and I'll place it myself. When answers come in, count them by answer and log the totals to Ripplewatch.`;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="churnText">Churn and growth over time</Label>
        <Textarea
          id="churnText"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          maxLength={20000}
          placeholder={"Paste it in any layout, for example:\nMonth, Customers at start, New, Cancelled, Revenue\nSep 2026, 10400, 600, 430, 52000\nOct 2026, 10570, 590, 600, 52500"}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={() => void readIt(text)} disabled={busy !== null || text.trim().length < 8}>
            {busy === "read" ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Read it
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
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
        </div>
        <p className="text-xs text-muted-foreground">
          A month and either the churn rate or the customers who cancelled is enough. More months make the read more
          reliable, and revenue adds a growth figure. Any layout works.
        </p>
      </div>

      <div className="space-y-2 rounded-md border border-border p-3">
        <p className="text-sm font-medium">Only have two numbers?</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="churnLast" className="text-xs text-muted-foreground">
              Churn last month (%)
            </Label>
            <Input id="churnLast" inputMode="decimal" className="w-28" value={lastMonth} onChange={(e) => setLastMonth(e.target.value)} placeholder="6.2" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="churnBefore" className="text-xs text-muted-foreground">
              The month before (%)
            </Label>
            <Input id="churnBefore" inputMode="decimal" className="w-28" value={monthBefore} onChange={(e) => setMonthBefore(e.target.value)} placeholder="4.8" />
          </div>
          <Button type="button" size="sm" variant="outline" onClick={useTwoNumbers}>
            Use these
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {read && periods ? (
        <div className="space-y-3 rounded-md border border-primary/30 bg-primary/[0.04] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">What I read</p>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs font-medium",
                read.confidence === "low" ? "border-border text-muted-foreground" : "border-primary/40 text-primary"
              )}
            >
              {read.confidence === "low" ? "Early lead" : "Fair confidence"}
            </span>
          </div>
          <p className="text-sm">{read.headline}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs tabular-nums">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3 font-medium">Month</th>
                  <th className="py-1 pr-3 font-medium">Churn</th>
                  <th className="py-1 pr-3 font-medium">Customers</th>
                  <th className="py-1 pr-3 font-medium">New</th>
                  <th className="py-1 pr-3 font-medium">Cancelled</th>
                  <th className="py-1 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.periodStart} className="border-t border-border/60">
                    <td className="py-1 pr-3">{monthLabel(p.periodStart)}</td>
                    <td className="py-1 pr-3">{num(periodChurn(p) === null ? null : Math.round((periodChurn(p) as number) * 10) / 10, "%")}</td>
                    <td className="py-1 pr-3">{num(p.customersStart)}</td>
                    <td className="py-1 pr-3">{num(p.newCustomers)}</td>
                    <td className="py-1 pr-3">{num(p.cancelledCustomers)}</td>
                    <td className="py-1">{num(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {saved ? (
            <p className="flex items-center gap-1.5 text-sm text-primary">
              <Check className="size-4" />
              Saved. Your assistant can use this now.
            </p>
          ) : (
            <div className="flex items-center gap-3">
              <Button type="button" size="sm" onClick={() => void save()} disabled={busy !== null}>
                {busy === "save" ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Save these months
              </Button>
              <p className="text-xs text-muted-foreground">Check the table first. Re-sending a month updates it.</p>
            </div>
          )}
        </div>
      ) : null}

      <div className="space-y-3 rounded-md border border-border p-4">
        <p className="text-sm font-medium">Or have your assistant pull it</p>
        <CopyPrompt label="From your billing tool (Stripe, Shopify, a subscription platform)" text={pullPrompt} />
      </div>

      <div className={cn("space-y-3 rounded-md border p-4", rising ? "border-primary/40 bg-primary/[0.04]" : "border-border")}>
        <p className="text-sm font-medium">{rising ? "Churn is rising. Ask people why." : "Want to know why people leave?"}</p>
        <p className="text-xs text-muted-foreground">
          Your numbers show when churn moved. Only your customers can say why, and whether they also use a competitor.
          Copy this into Claude or ChatGPT and it will draft a short cancellation survey for you to place. Ripplewatch
          doesn&apos;t host or send it.
        </p>
        <CopyPrompt label="Draft a cancellation survey" text={surveyPrompt} />
      </div>
    </div>
  );
}
