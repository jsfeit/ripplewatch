"use client";

import { useState } from "react";
import { Copy, Check, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { timeAgo } from "@/lib/date";

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
};

export function ApiKeysManager({ initialKeys }: { initialKeys: ApiKey[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function createKey() {
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create key.");
      setKeys((prev) => [{ id: data.id, name: data.name, key_prefix: data.key_prefix, last_used_at: null, created_at: data.created_at }, ...prev]);
      setRevealedKey(data.key);
      setNewKeyName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create key.");
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    setRevokingId(id);
    try {
      await fetch(`/api/settings/api-keys/${id}`, { method: "DELETE" });
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } finally {
      setRevokingId(null);
    }
  }

  async function copyRevealedKey() {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">API keys</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only access to your competitors, signals, trends, momentum, and weekly verdict, for wiring
          Ripplewatch into your own agents or tools.{" "}
          <a href="/docs/api" className="text-primary underline underline-offset-2">
            View API docs
          </a>
          .
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder={'Key name (e.g. "Internal agent")'}
          className="flex-1"
        />
        <Button type="button" onClick={createKey} disabled={creating}>
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Generate key
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">No API keys yet.</p>
      ) : (
        <ul className="space-y-2">
          {keys.map((k) => (
            <li
              key={k.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
            >
              <div>
                <p className="text-sm font-medium">{k.name}</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {k.key_prefix} · {timeAgo(k.last_used_at, { nullLabel: "never used", prefix: "used" })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => revokeKey(k.id)}
                disabled={revokingId === k.id}
                aria-label={`Revoke ${k.name}`}
              >
                {revokingId === k.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={revealedKey !== null} onOpenChange={(open) => !open && setRevealedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your new API key</DialogTitle>
            <DialogDescription>
              Copy this now: it won&apos;t be shown again. If you lose it, revoke it and generate a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 p-2.5">
            <code className="flex-1 overflow-x-auto text-xs">{revealedKey}</code>
            <Button variant="outline" size="icon" onClick={copyRevealedKey} aria-label="Copy key">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealedKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
