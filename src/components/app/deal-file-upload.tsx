"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DealImportReview } from "@/components/app/deal-import-review";
import { DealDataGuide } from "@/components/app/deal-data-guide";
import { formatWinLossImportMessage, type ImportMessageData } from "@/lib/win-loss-import";
import { splitCsvIntoBatches } from "@/lib/csv-split";
import type { DealCoverage } from "@/lib/deal-coverage";
import type { DealImportPreview, DealImportSummary } from "@/lib/deal-ingest";

// Columns are worked out from the first rows; the full file is then sent in batches that fit one request.
const PREVIEW_ROWS = 1500;
const COMMIT_ROWS = 1000;

type Pending = { text: string; filename: string; totalRows: number; preview: DealImportPreview };

// Upload a deal export in any layout: say how it was read, let the user fix a column, then import it
// in batches. Shared by the Connect Data tab and the Plus dashboard so both behave the same.
export function DealFileUpload({ onDone, label = "Upload deals (any CSV)" }: { onDone?: () => void; label?: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleFile(file: File) {
    setReading(true);
    setMessage(null);
    setPending(null);
    try {
      const text = await file.text();
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
      setMessage(err instanceof Error ? err.message : "Could not read that file.");
    } finally {
      setReading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // The user changed a column: re-read the start of the file with it so the numbers shown stay true.
  async function remap(mapping: DealImportPreview["mapping"]) {
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

  async function confirm() {
    if (!pending) return;
    setCommitting(true);
    try {
      const { totalRows, batches } = splitCsvIntoBatches(pending.text, COMMIT_ROWS);
      const total = {
        totalExtracted: 0,
        imported: 0,
        skipped: 0,
        updated: 0,
        generalReasonsAdded: 0,
        generalReasonsSkipped: 0,
        generalWonReasonsAdded: 0,
        generalWonReasonsSkipped: 0,
        suggestedCompetitors: [] as string[],
        untrackedAlreadySuggested: 0,
        rowsConsidered: totalRows,
        totalRows,
        truncated: false,
      };
      let coverage: DealCoverage | undefined;
      for (let i = 0; i < batches.length; i++) {
        setProgress(
          batches.length > 1
            ? `Importing deals ${i * COMMIT_ROWS + 1} to ${Math.min(totalRows, (i + 1) * COMMIT_ROWS)} of ${totalRows}...`
            : null
        );
        const res = await fetch("/api/win-loss/import/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: batches[i], mapping: pending.preview.mapping, filename: pending.filename }),
        });
        const data = (await res.json()) as DealImportSummary & { error?: string };
        if (!res.ok) {
          throw new Error(
            `${data.error ?? "Import failed."}${i > 0 ? ` The first ${i * COMMIT_ROWS} deals were saved; uploading the file again picks up where it stopped.` : ""}`
          );
        }
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
        coverage = data.coverage;
      }
      setMessage(`${formatWinLossImportMessage("Upload", total as ImportMessageData, false)} ${coverage?.message ?? ""}`.trim());
      setPending(null);
      onDone?.();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setProgress(null);
      setCommitting(false);
    }
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,text/csv,text/plain"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={reading || committing}>
        {reading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        {label}
      </Button>

      <DealDataGuide />

      {reading ? <p className="mt-2 text-xs text-muted-foreground">Reading your file...</p> : null}
      {progress ? <p className="mt-2 text-xs text-muted-foreground">{progress}</p> : null}
      {pending ? (
        <DealImportReview
          preview={pending.preview}
          busy={committing}
          onChange={remap}
          onConfirm={confirm}
          onCancel={() => setPending(null)}
          fileRows={pending.totalRows}
        />
      ) : null}
      {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
