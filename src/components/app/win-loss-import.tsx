"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type ImportResult = { imported: number; skipped: number };

export function WinLossImport({ hubspotConnected }: { hubspotConnected: boolean }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ source: string; data: ImportResult } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/competitors/win-loss/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setResult({ source: "CSV", data });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleHubspotSync() {
    setSyncing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/competitors/win-loss/sync-hubspot", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed.");
      setResult({ source: "HubSpot", data });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-lg border border-dashed border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium">Import win/loss data</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Bring in data however you already have it. Rows are matched to a tracked competitor by name; anything
          that doesn&apos;t clearly name one is skipped rather than guessed at.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          Upload CSV
        </Button>
        {hubspotConnected ? (
          <Button variant="outline" size="sm" onClick={handleHubspotSync} disabled={syncing}>
            {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Sync from HubSpot
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            <Link href="/app/settings" className="underline">
              Connect HubSpot
            </Link>{" "}
            to sync closed-lost deals automatically.
          </p>
        )}
      </div>

      {error ? <p className="w-full text-xs text-destructive">{error}</p> : null}
      {result ? (
        <p className="w-full text-xs text-muted-foreground">
          {result.source}: imported {result.data.imported}, skipped {result.data.skipped}
          {result.data.skipped > 0 ? " (didn't clearly match a tracked competitor)" : ""}.
        </p>
      ) : null}
    </div>
  );
}
