"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Panel } from "@/components/ui/panel";
import type { DealImportPreview } from "@/lib/deal-ingest";

type Mapping = DealImportPreview["mapping"];

const NONE = "__none__";

const ROLES: { key: Exclude<keyof Mapping, "reason" | "dateOrder" | "outcomeValues">; label: string; hint: string }[] = [
  { key: "closeDate", label: "Close date", hint: "When the deal closed. Needed for trends over time." },
  { key: "outcome", label: "Won or lost", hint: "Stage, status or outcome." },
  { key: "amount", label: "Amount", hint: "Deal value, if you have it." },
  { key: "competitor", label: "Competitor", hint: "Who won, if it is recorded." },
  { key: "dealName", label: "Deal or account name", hint: "" },
  { key: "dealId", label: "Deal ID", hint: "Lets a re-upload update deals instead of duplicating them." },
];

// Shows how a deal file was read before anything is saved, and lets the user fix any column.
export function DealImportReview({
  preview,
  busy,
  onChange,
  onConfirm,
  onCancel,
}: {
  preview: DealImportPreview;
  busy: boolean;
  onChange: (mapping: Mapping) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { mapping, report, columns } = preview;
  const datedPct = report.usable === 0 ? 0 : Math.round((report.withDate / report.usable) * 100);
  const span = report.earliest && report.latest ? `${report.earliest} to ${report.latest}` : "no dates found";

  return (
    <Panel className="mt-3 space-y-3 border-primary/30 bg-primary/[0.03] p-4">
      <div>
        <p className="text-sm font-semibold">Here&rsquo;s how I read your file</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {report.usable.toLocaleString()} of {report.totalRows.toLocaleString()} rows are closed deals
          {report.skippedOpen > 0 ? ` (${report.skippedOpen} still open, skipped)` : ""}. Dates on {datedPct}% of them
          ({span}). Reasons on {report.usable === 0 ? 0 : Math.round((report.withReason / report.usable) * 100)}%.
          Check the columns below, change any that are wrong, then confirm.
        </p>
        {datedPct < 70 ? (
          <p className="mt-2 rounded-md border border-amber-500/25 bg-amber-500/[0.06] px-2.5 py-1.5 text-xs">
            Without close dates I can&rsquo;t see how things change over time. If your export has a date column, pick it
            below. Older deals are welcome too: more history makes every answer sharper.
          </p>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {ROLES.map((role) => (
          <label key={role.key} className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">{role.label}</span>
            <Select
              value={mapping[role.key] ?? NONE}
              onValueChange={(v) => onChange({ ...mapping, [role.key]: v === NONE ? null : v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{() => mapping[role.key] ?? "Not in this file"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not in this file</SelectItem>
                {columns.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ))}
      </div>

      <div className="space-y-1">
        <span className="text-[11px] font-medium text-muted-foreground">Why it was won or lost (any columns that explain it)</span>
        <div className="flex flex-wrap gap-1.5">
          {columns.map((c) => {
            const on = mapping.reason.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => onChange({ ...mapping, reason: on ? mapping.reason.filter((r) => r !== c) : [...mapping.reason, c] })}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] ${on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {Object.keys(mapping.outcomeValues).length > 0 ? (
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">What each stage means</span>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {Object.entries(mapping.outcomeValues).map(([value, outcome]) => (
              <div key={value} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1">
                <span className="truncate text-xs">{value}</span>
                <Select value={outcome} onValueChange={(v) => v && onChange({ ...mapping, outcomeValues: { ...mapping.outcomeValues, [value]: v as typeof outcome } })}>
                  <SelectTrigger className="h-7 w-28">
                    <SelectValue>{() => outcome}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="won">won</SelectItem>
                    <SelectItem value="lost">lost</SelectItem>
                    <SelectItem value="churned">churned</SelectItem>
                    <SelectItem value="ignore">skip (open)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {preview.sample.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr>
                <th className="px-2 py-1 font-medium">Closed</th>
                <th className="px-2 py-1 font-medium">Outcome</th>
                <th className="px-2 py-1 font-medium">Competitor</th>
                <th className="px-2 py-1 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {preview.sample.map((s, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-2 py-1 tabular-nums">{s.closedOn ?? "no date"}</td>
                  <td className="px-2 py-1">{s.outcome}</td>
                  <td className="px-2 py-1">{s.competitor ?? "not named"}</td>
                  <td className="max-w-[260px] truncate px-2 py-1">{s.reason ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {preview.truncated ? (
        <p className="text-[11px] text-muted-foreground">This file is very large, so only the first rows are included. Upload the rest in a second file.</p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button size="sm" onClick={onConfirm} disabled={busy || report.usable === 0}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Import {report.usable.toLocaleString()} deals
        </Button>
      </div>
    </Panel>
  );
}
