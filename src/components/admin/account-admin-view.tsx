"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SIGNAL_TYPE_LABELS } from "@/lib/mock-data";
import { SignalDialog, type SignalFormValues } from "./signal-dialog";
import type { Database } from "@/lib/supabase/types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];
type Competitor = Database["public"]["Tables"]["competitors"]["Row"];
type Signal = Database["public"]["Tables"]["signals"]["Row"];

const TIER_LABELS: Record<string, string> = {
  starter: "Starter",
  plus: "Plus",
  plus_human: "Plus + Human",
};

export function AccountAdminView({
  account,
  competitors: initialCompetitors,
  signals: initialSignals,
}: {
  account: Account;
  competitors: Competitor[];
  signals: Signal[];
}) {
  const [tier, setTier] = useState(account.tier);
  const [savingTier, setSavingTier] = useState(false);
  const [competitors, setCompetitors] = useState(initialCompetitors);
  const [signals, setSignals] = useState(initialSignals);
  const [newCompetitorName, setNewCompetitorName] = useState("");
  const [newCompetitorDomain, setNewCompetitorDomain] = useState("");
  const [addingCompetitor, setAddingCompetitor] = useState(false);

  const [dialogCompetitorId, setDialogCompetitorId] = useState<string | null>(null);
  const [editingSignal, setEditingSignal] = useState<Signal | null>(null);

  async function handleAddCompetitor() {
    if (!newCompetitorName.trim()) return;
    setAddingCompetitor(true);
    const res = await fetch("/api/admin/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_id: account.id,
        name: newCompetitorName,
        domain: newCompetitorDomain,
      }),
    });
    const data = await res.json();
    setAddingCompetitor(false);
    if (res.ok) {
      setCompetitors((prev) => [...prev, data.competitor]);
      setNewCompetitorName("");
      setNewCompetitorDomain("");
    }
  }

  async function handleRemoveCompetitor(id: string) {
    setCompetitors((prev) => prev.filter((c) => c.id !== id));
    setSignals((prev) => prev.filter((s) => s.competitor_id !== id));
    await fetch(`/api/admin/competitors/${id}`, { method: "DELETE" });
  }

  async function handleSaveCrawlUrls(id: string, pricingUrl: string, careersUrl: string) {
    const res = await fetch(`/api/admin/competitors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pricing_url: pricingUrl, careers_url: careersUrl }),
    });
    const data = await res.json();
    if (res.ok) {
      setCompetitors((prev) => prev.map((c) => (c.id === id ? data.competitor : c)));
    }
  }

  async function handleSaveSignal(values: SignalFormValues) {
    if (editingSignal) {
      const res = await fetch(`/api/admin/signals/${editingSignal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (res.ok) {
        setSignals((prev) => prev.map((s) => (s.id === editingSignal.id ? data.signal : s)));
      }
    } else if (dialogCompetitorId) {
      const res = await fetch("/api/admin/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, competitor_id: dialogCompetitorId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSignals((prev) => [data.signal, ...prev]);
      }
    }
    setDialogCompetitorId(null);
    setEditingSignal(null);
  }

  async function handleDeleteSignal(id: string) {
    setSignals((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/admin/signals/${id}`, { method: "DELETE" });
  }

  async function handleTierChange(newTier: string | null) {
    if (!newTier) return;
    const previous = tier;
    setTier(newTier as typeof tier);
    setSavingTier(true);
    const res = await fetch(`/api/admin/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: newTier }),
    });
    setSavingTier(false);
    if (!res.ok) setTier(previous);
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{account.name}</h1>
          <Select value={tier} onValueChange={handleTierChange}>
            <SelectTrigger className="h-8 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TIER_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {savingTier ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
          {account.subscription_status ? (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {account.subscription_status}
            </Badge>
          ) : null}
        </div>
        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
          {account.positioning ? <p>{account.positioning}</p> : null}
          {account.icp ? <p>ICP: {account.icp}</p> : null}
          <p>
            Growth motion:{" "}
            {account.has_sales_crm && account.has_plg
              ? "Hybrid"
              : account.has_sales_crm
                ? "Sales-led"
                : account.has_plg
                  ? "Self-serve"
                  : "Not set"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-medium">Competitors</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newCompetitorName}
              onChange={(e) => setNewCompetitorName(e.target.value)}
              placeholder="Competitor name"
              className="flex-1"
            />
            <Input
              value={newCompetitorDomain}
              onChange={(e) => setNewCompetitorDomain(e.target.value)}
              placeholder="domain.com"
              className="flex-1"
            />
            <Button type="button" onClick={handleAddCompetitor} disabled={addingCompetitor}>
              <Plus className="size-4" />
              Add
            </Button>
          </div>

          <div className="space-y-4">
            {competitors.map((competitor) => {
              const competitorSignals = signals.filter((s) => s.competitor_id === competitor.id);
              return (
                <div key={competitor.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{competitor.name}</p>
                      {competitor.domain ? (
                        <p className="text-xs text-muted-foreground">{competitor.domain}</p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDialogCompetitorId(competitor.id)}
                      >
                        <Plus className="size-4" />
                        Add signal
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveCompetitor(competitor.id)}
                        aria-label={`Remove ${competitor.name}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Input
                      defaultValue={competitor.pricing_url ?? ""}
                      placeholder="Pricing page URL (for scraping)"
                      className="text-xs"
                      onBlur={(e) =>
                        handleSaveCrawlUrls(competitor.id, e.target.value, competitor.careers_url ?? "")
                      }
                    />
                    <Input
                      defaultValue={competitor.careers_url ?? ""}
                      placeholder="Careers page URL (for scraping)"
                      className="text-xs"
                      onBlur={(e) =>
                        handleSaveCrawlUrls(competitor.id, competitor.pricing_url ?? "", e.target.value)
                      }
                    />
                  </div>

                  {competitorSignals.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {competitorSignals.map((signal) => (
                        <div
                          key={signal.id}
                          className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-medium">{signal.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {SIGNAL_TYPE_LABELS[signal.type]} · {signal.occurred_on}
                              {signal.scored ? ` · ${signal.relevance_level} relevance` : " · raw"}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setEditingSignal(signal)}
                              aria-label="Edit signal"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleDeleteSignal(signal.id)}
                              aria-label="Delete signal"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">No signals yet.</p>
                  )}
                </div>
              );
            })}
            {competitors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No competitors yet.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <SignalDialog
        key={editingSignal?.id ?? dialogCompetitorId ?? "closed"}
        open={dialogCompetitorId !== null || editingSignal !== null}
        signal={editingSignal}
        onOpenChange={(open) => {
          if (!open) {
            setDialogCompetitorId(null);
            setEditingSignal(null);
          }
        }}
        onSave={handleSaveSignal}
      />
    </div>
  );
}
