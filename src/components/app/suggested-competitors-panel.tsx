"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, avatarColor } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type Suggestion = Database["public"]["Tables"]["suggested_competitors"]["Row"];

// Weekly discovery job surfaces these (see /api/cron/discover-competitors);
// this panel is how a member reviews and acts on them. Renders nothing once
// there's nothing pending, rather than an empty-state card — a "no new
// competitors this week" message isn't worth the visual noise every time
// most of them turn up nothing new.
export function SuggestedCompetitorsPanel({
  suggestions: initialSuggestions,
}: {
  suggestions: Suggestion[];
}) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [upgradeNeeded, setUpgradeNeeded] = useState(false);

  async function handleAdd(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/suggested-competitors/${id}/add`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setBusyId(null);
    if (!res.ok) {
      if (data?.upgradeRequired) setUpgradeNeeded(true);
      return;
    }
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
    router.refresh();
  }

  async function handleDismiss(id: string) {
    setBusyId(id);
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/suggested-competitors/${id}/dismiss`, { method: "POST" });
    setBusyId(null);
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="mb-6 space-y-3 rounded-xl border border-primary/25 bg-primary/[0.03] p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h2 className="font-medium">Suggested competitors</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        New or increasingly visible companies we found that look like they might compete for the same buyers.
        Add the ones worth tracking, or dismiss the rest.
      </p>

      {upgradeNeeded ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-400">
          Your plan&apos;s competitor limit is full.{" "}
          <Link href="/app/settings?tab=plan" className="underline">
            Upgrade
          </Link>{" "}
          to add another.
        </div>
      ) : null}

      <div className="space-y-2">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  avatarColor(s.name)
                )}
              >
                {s.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{s.name}</p>
                  {s.category ? (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {s.category}
                    </Badge>
                  ) : null}
                </div>
                {s.reasoning ? <p className="mt-0.5 text-xs text-muted-foreground">{s.reasoning}</p> : null}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleAdd(s.id)}
                disabled={busyId === s.id}
                aria-label={`Add ${s.name}`}
              >
                {busyId === s.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDismiss(s.id)}
                disabled={busyId === s.id}
                aria-label={`Dismiss ${s.name}`}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

