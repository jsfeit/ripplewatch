"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Check, Loader2, Pencil, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, avatarColor } from "@/lib/utils";
import { COMPETITOR_LIMIT, competitorLimitLabel } from "@/lib/tier-limits";
import type { Database } from "@/lib/supabase/types";

type Competitor = Database["public"]["Tables"]["competitors"]["Row"];
type Tier = Database["public"]["Tables"]["accounts"]["Row"]["tier"];

export function CompetitorManager({
  competitors: initialCompetitors,
  tier,
  activeId,
}: {
  competitors: Competitor[];
  tier: Tier;
  activeId?: string;
}) {
  const router = useRouter();
  const [competitors, setCompetitors] = useState(initialCompetitors);
  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDomain, setEditDomain] = useState("");
  const [saving, setSaving] = useState(false);

  const competitorLimit = COMPETITOR_LIMIT[tier];
  const isOverLimit = competitors.length > competitorLimit;
  // Same "earliest N stay covered" ordering the cron job uses, so this
  // matches which competitors are actually still being monitored.
  const monitoredIds = new Set(
    [...competitors]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, competitorLimit)
      .map((c) => c.id)
  );

  async function handleAdd() {
    if (!newName.trim()) return;
    setAdding(true);
    setError("");
    const res = await fetch("/api/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, domain: newDomain }),
    });
    const data = await res.json();
    setAdding(false);
    if (!res.ok) {
      setError(data.error ?? "Could not add competitor.");
      return;
    }
    setCompetitors((prev) => [...prev, data.competitor]);
    setNewName("");
    setNewDomain("");
    router.refresh();
  }

  async function handleRemove(id: string) {
    setCompetitors((prev) => prev.filter((c) => c.id !== id));
    await fetch(`/api/competitors/${id}`, { method: "DELETE" });
    if (id === activeId) {
      router.push("/app/competitors");
    } else {
      router.refresh();
    }
  }

  function startEditing(c: Competitor) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditDomain(c.domain ?? "");
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/competitors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, domain: editDomain }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setCompetitors((prev) => prev.map((c) => (c.id === id ? data.competitor : c)));
      setEditingId(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="font-medium">Manage competitors</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {`${competitors.length} of ${competitorLimitLabel(tier)} tracked on your plan. Keep names and domains consistent once you start tracking a competitor — the scoring model learns from each one's history, so renaming or re-adding it under a slightly different name resets that context.`}
        </p>
      </div>

      {isOverLimit ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            You have {competitors.length} competitors but your plan only monitors{" "}
            {competitorLimitLabel(tier)}. The {competitors.length - competitorLimit} most recently
            added are no longer being crawled — remove some or{" "}
            <Link href="/pricing" className="underline">
              upgrade
            </Link>{" "}
            to keep tracking all of them.
          </p>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Competitor name"
          className="flex-1"
        />
        <Input
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder="domain.com"
          className="flex-1"
        />
        <Button type="button" onClick={handleAdd} disabled={adding}>
          {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="space-y-2">
        {competitors.map((c) => (
          <div
            key={c.id}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors",
              c.id === activeId
                ? "border-primary/40 bg-primary/[0.03]"
                : "border-border hover:border-border/80 hover:bg-secondary/30"
            )}
          >
            {editingId === c.id ? (
              <>
                <div className="flex flex-1 gap-2">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1" />
                  <Input value={editDomain} onChange={(e) => setEditDomain(e.target.value)} className="flex-1" />
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSaveEdit(c.id)}
                    disabled={saving}
                    aria-label="Save"
                  >
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setEditingId(null)} aria-label="Cancel">
                    <X className="size-4" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full text-xs font-semibold",
                      avatarColor(c.name)
                    )}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                  {c.id === activeId ? (
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.domain ?? "No domain set"}</p>
                    </div>
                  ) : (
                    <Link href={`/app/competitors/${c.id}`} className="group">
                      <p className="text-sm font-medium group-hover:underline">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.domain ?? "No domain set"}</p>
                    </Link>
                  )}
                  {!monitoredIds.has(c.id) ? (
                    <Badge variant="outline" className="text-muted-foreground">
                      Not monitored
                    </Badge>
                  ) : null}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startEditing(c)}
                    aria-label={`Edit ${c.name}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(c.id)}
                    aria-label={`Remove ${c.name}`}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
        {competitors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No competitors yet — add your first one above.</p>
        ) : null}
      </div>
    </div>
  );
}
