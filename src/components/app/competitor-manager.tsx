"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Check, FileText, Loader2, Pencil, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, avatarColor } from "@/lib/utils";
import { COMPETITOR_LIMIT, competitorLimitLabel } from "@/lib/tier-limits";
import { MOMENTUM_STYLES, type MomentumResult } from "@/lib/momentum";
import type { Database } from "@/lib/supabase/types";

type Competitor = Database["public"]["Tables"]["competitors"]["Row"];
type Tier = Database["public"]["Tables"]["accounts"]["Row"]["tier"];

type SortOption = "momentum" | "traffic" | "name" | "date";
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "momentum", label: "Momentum" },
  { value: "traffic", label: "Traffic" },
  { value: "name", label: "Name" },
  { value: "date", label: "Date added" },
];
const SORT_STORAGE_KEY = "ripplewatch:competitor-sort";

export function CompetitorManager({
  competitors: initialCompetitors,
  tier,
  activeId,
  momentum,
  traffic,
  seoAllowed,
}: {
  competitors: Competitor[];
  tier: Tier;
  activeId?: string;
  // Keyed by competitor id — same computeMomentum result the Trends
  // page renders, just surfaced here too so it's visible on the page
  // people actually click into a competitor from, not only its own tab.
  momentum?: Record<string, MomentumResult>;
  // Keyed by competitor id — just the traffic estimate, enough to sort by;
  // the full competitor_seo record lives on the Trends page.
  traffic?: Record<string, number | null>;
  // Hides the "Traffic" sort option entirely for Starter, same gate the
  // Trends page uses — sorting by a metric that's always empty for
  // this tier would be confusing, not just unhelpful.
  seoAllowed?: boolean;
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
  const [editCategory, setEditCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("momentum");

  // Read the saved preference after mount rather than during initial state
  // (avoids an SSR/client hydration mismatch, since the server has no way
  // to know what's in localStorage) — one-frame default-to-saved flash is
  // an acceptable tradeoff for not fighting hydration.
  useEffect(() => {
    const saved = localStorage.getItem(SORT_STORAGE_KEY);
    if (saved === "momentum" || saved === "traffic" || saved === "name" || saved === "date") {
      // Syncing one-time from an external system (localStorage) on mount —
      // exactly the case the lint rule's own guidance calls out as fine.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSortBy(saved);
    }
  }, []);

  function changeSort(next: SortOption) {
    setSortBy(next);
    localStorage.setItem(SORT_STORAGE_KEY, next);
  }

  const competitorLimit = COMPETITOR_LIMIT[tier];
  const isOverLimit = competitors.length > competitorLimit;
  // Same "earliest N stay covered" ordering the cron job uses, so this
  // matches which competitors are actually still being monitored —
  // deliberately independent of the display sort below.
  const monitoredIds = new Set(
    [...competitors]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, competitorLimit)
      .map((c) => c.id)
  );

  const sortedCompetitors = [...competitors].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "date") return a.created_at.localeCompare(b.created_at);
    if (sortBy === "traffic") {
      const trafficA = traffic?.[a.id];
      const trafficB = traffic?.[b.id];
      if (trafficA == null && trafficB == null) return a.name.localeCompare(b.name);
      if (trafficA == null) return 1;
      if (trafficB == null) return -1;
      return trafficB - trafficA;
    }
    // momentum (default): highest score first, no-history competitors last
    const scoreA = momentum?.[a.id]?.score;
    const scoreB = momentum?.[b.id]?.score;
    if (scoreA == null && scoreB == null) return a.name.localeCompare(b.name);
    if (scoreA == null) return 1;
    if (scoreB == null) return -1;
    return scoreB - scoreA;
  });

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
    setEditCategory(c.category ?? "");
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/competitors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, domain: editDomain, category: editCategory }),
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
          {`${competitors.length} of ${competitorLimitLabel(tier)} tracked on your plan. Keep names and domains consistent once you start tracking a competitor: the scoring model learns from each one's history, so renaming or re-adding it under a slightly different name resets that context.`}
        </p>
      </div>

      {isOverLimit ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            You have {competitors.length} competitors but your plan only monitors{" "}
            {competitorLimitLabel(tier)}. The {competitors.length - competitorLimit} most recently
            added are no longer being crawled; remove some or{" "}
            <Link href="/app/settings?tab=plan" className="underline">
              upgrade
            </Link>{" "}
            to keep tracking all of them.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
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

      {competitors.length > 0 ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium">Comparing to</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick one competitor below to view its one-to-one comparison and fact sheet.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Sort by</span>
            <div className="flex flex-wrap gap-1">
              {SORT_OPTIONS.filter((opt) => opt.value !== "traffic" || seoAllowed).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => changeSort(opt.value)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    sortBy === opt.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {sortedCompetitors.map((c) => (
          <div
            key={c.id}
            role={c.id !== activeId && editingId !== c.id ? "button" : undefined}
            tabIndex={c.id !== activeId && editingId !== c.id ? 0 : undefined}
            onClick={
              c.id !== activeId && editingId !== c.id ? () => router.push(`/app/competitors/${c.id}`) : undefined
            }
            onKeyDown={
              c.id !== activeId && editingId !== c.id
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/app/competitors/${c.id}`);
                    }
                  }
                : undefined
            }
            className={cn(
              "flex flex-col items-start gap-3 rounded-lg border p-3 transition-colors sm:flex-row sm:items-center sm:justify-between",
              c.id === activeId
                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                : editingId === c.id
                  ? "border-border"
                  : "cursor-pointer border-border hover:border-border/80 hover:bg-secondary/30"
            )}
          >
            {editingId === c.id ? (
              <>
                <div className="flex w-full flex-col gap-2 sm:flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1" placeholder="Name" />
                    <Input value={editDomain} onChange={(e) => setEditDomain(e.target.value)} className="flex-1" placeholder="domain.com" />
                  </div>
                  <Input
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder="Category, e.g. Accounting/ERP software for SMBs"
                  />
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
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      avatarColor(c.name)
                    )}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                  {c.id === activeId ? (
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <Badge className="shrink-0 border-primary/30 bg-primary/15 text-primary">Comparing</Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.domain ?? "No domain set"}
                        {c.category ? ` · ${c.category}` : ""}
                      </p>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.domain ?? "No domain set"}
                        {c.category ? ` · ${c.category}` : ""}
                      </p>
                    </div>
                  )}
                  {!monitoredIds.has(c.id) ? (
                    <Badge variant="outline" className="shrink-0 text-muted-foreground">
                      Not monitored
                    </Badge>
                  ) : null}
                  {momentum?.[c.id] && momentum[c.id].score !== null ? (
                    <span
                      className={cn(
                        "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        MOMENTUM_STYLES[momentum[c.id].label]
                      )}
                    >
                      {momentum[c.id].score! > 0 ? "+" : ""}
                      {momentum[c.id].score} · {momentum[c.id].label}
                    </span>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Link
                    href={`/app/competitors/${c.id}#fact-sheet`}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`View ${c.name} fact sheet`}
                    title="View fact sheet"
                    className={buttonVariants({ variant: "ghost", size: "icon" })}
                  >
                    <FileText className="size-4" />
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(c);
                    }}
                    aria-label={`Edit ${c.name}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(c.id);
                    }}
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
          <p className="text-sm text-muted-foreground">No competitors yet; add your first one above.</p>
        ) : null}
      </div>
    </div>
  );
}
