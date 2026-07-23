"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Document = { id: string; file_name: string; size_bytes: number | null };

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Free-form context docs (positioning decks, battlecards, etc). Stored only
// for now — nothing here feeds them into scoring yet, that's a follow-up
// once there's a plan for parsing cost/format handling.
export function DocumentUpload() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/onboarding/documents")
      .then((res) => res.json())
      .then((data) => setDocuments(data.documents ?? []))
      .catch(() => {});
  }, []);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/onboarding/documents", { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setError(data.error ?? "Upload failed.");
      return;
    }
    setDocuments((prev) => [data.document, ...prev]);
  }

  async function handleRemove(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    await fetch(`/api/onboarding/documents/${id}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Attach supporting documents (optional)</p>
        <p className="text-xs text-muted-foreground">
          Positioning decks, battlecards, sales call notes — anything that helps us understand
          your business. Stored securely; up to 10MB per file.
        </p>
      </div>

      {documents.length > 0 ? (
        <ul className="space-y-1.5">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{doc.file_name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatSize(doc.size_bytes)}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => handleRemove(doc.id)}
                aria-label={`Remove ${doc.file_name}`}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <input ref={inputRef} type="file" className="hidden" onChange={handleFileSelect} />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {uploading ? "Uploading…" : "Upload a document"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
