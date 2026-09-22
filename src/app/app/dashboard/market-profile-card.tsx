"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Compass, ExternalLink, Loader2, Pencil, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/app/card";
import { EmptyState } from "@/components/app/empty-state";
import { timeAgo } from "@/lib/date";
import type { MarketDynamic, MarketGrowthDirection, MarketMaturity } from "@/lib/supabase/types";

export type MarketProfileData = {
  marketName: string;
  marketDescription: string;
  maturity: MarketMaturity;
  growthDirection: MarketGrowthDirection;
  growthReason: string;
  dynamics: MarketDynamic[];
  productSummary: string;
  generatedAt: string;
  userEditedAt: string | null;
};

const MATURITY_LABELS: Record<MarketMaturity, string> = {
  emerging: "Emerging",
  growing: "Growing",
  mature: "Mature",
  consolidating: "Consolidating",
};

// Same green/gray/rose family Momentum uses for Heating up/Steady/Cooling
// (see MOMENTUM_STYLES in lib/momentum.ts) — a different enum here
// (growth_direction is about the market, not one competitor), but reusing
// the color language keeps "heating up" meaning the same thing everywhere
// on the dashboard.
const GROWTH_STYLES: Record<MarketGrowthDirection, string> = {
  heating_up: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  steady: "bg-secondary text-muted-foreground",
  cooling: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

const GROWTH_LABELS: Record<MarketGrowthDirection, string> = {
  heating_up: "Heating up",
  steady: "Steady",
  cooling: "Cooling",
};

export function MarketProfileCard({ profile }: { profile: MarketProfileData | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => ({
    marketName: profile?.marketName ?? "",
    marketDescription: profile?.marketDescription ?? "",
    maturity: profile?.maturity ?? "growing",
    growthDirection: profile?.growthDirection ?? "steady",
    growthReason: profile?.growthReason ?? "",
    productSummary: profile?.productSummary ?? "",
  }));
  const [saving, setSaving] = useState(false);

  if (!profile) {
    return (
      <EmptyState
        icon={Compass}
        title="No market profile yet"
        description="Generates on your first crawl: what market you compete in, how it's moving, and where your product sits in it."
      />
    );
  }

  async function regenerate() {
    setRegenerating(true);
    setError("");
    try {
      const res = await fetch("/api/market-profile/regenerate", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't regenerate right now.");
        return;
      }
      router.refresh();
    } finally {
      setRegenerating(false);
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/market-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't save.");
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <Card>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Market name</label>
            <Input
              value={form.marketName}
              onChange={(e) => setForm({ ...form, marketName: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Market description</label>
            <Textarea
              value={form.marketDescription}
              onChange={(e) => setForm({ ...form, marketDescription: e.target.value })}
              rows={2}
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Maturity</label>
              <select
                value={form.maturity}
                onChange={(e) => setForm({ ...form, maturity: e.target.value as MarketMaturity })}
                className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {Object.entries(MATURITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Direction</label>
              <select
                value={form.growthDirection}
                onChange={(e) => setForm({ ...form, growthDirection: e.target.value as MarketGrowthDirection })}
                className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {Object.entries(GROWTH_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Why (growth reason)</label>
            <Textarea
              value={form.growthReason}
              onChange={(e) => setForm({ ...form, growthReason: e.target.value })}
              rows={2}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Your product</label>
            <Textarea
              value={form.productSummary}
              onChange={(e) => setForm({ ...form, productSummary: e.target.value })}
              rows={2}
              className="mt-1"
            />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Save
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{profile.marketName}</h3>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-secondary">
              {MATURITY_LABELS[profile.maturity]}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${GROWTH_STYLES[profile.growthDirection]}`}>
              {GROWTH_LABELS[profile.growthDirection]}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">{profile.marketDescription}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">{profile.growthReason}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Edit"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={regenerate}
            disabled={regenerating}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
            title="Regenerate from fresh research"
          >
            {regenerating ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          </button>
        </div>
      </div>

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

      {profile.dynamics.length > 0 ? (
        <ul className="mt-3 space-y-2 border-t border-dashed border-border pt-3">
          {profile.dynamics.map((d) => (
            <li key={d.text} className="text-xs leading-relaxed text-muted-foreground">
              <span className="text-foreground">{d.text}</span>
              {d.source ? (
                <>
                  {" "}
                  <a
                    href={d.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
                  >
                    {d.source.name}
                    <ExternalLink className="size-2.5" />
                  </a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 rounded-lg bg-secondary/40 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Your product</p>
        <p className="mt-1 text-xs leading-relaxed text-foreground">{profile.productSummary}</p>
      </div>

      <p className="mt-2 text-[10.5px] text-muted-foreground">
        {profile.userEditedAt ? `Edited by you ${timeAgo(profile.userEditedAt)}` : `Researched ${timeAgo(profile.generatedAt)}`}
      </p>
    </Card>
  );
}
