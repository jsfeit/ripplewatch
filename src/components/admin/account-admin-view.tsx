"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, Loader2, RefreshCw, Sparkles, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SIGNAL_TYPE_LABELS } from "@/lib/mock-data";
import { SignalDialog, type SignalFormValues } from "./signal-dialog";
import { TIERS } from "@/lib/tiers";
import { timeAgo } from "@/lib/date";
import type { Database } from "@/lib/supabase/types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];
type Competitor = Database["public"]["Tables"]["competitors"]["Row"];
type Signal = Database["public"]["Tables"]["signals"]["Row"];
type LlmUsageByFunction = { functionName: string; tokens: number; costUsd: number; calls: number };

const TIER_LABELS: Record<string, string> = {
  starter: "Starter",
  plus: "Plus",
  connect: "Connect",
};

export type ConnectAdminData = {
  balanceUsd: number;
  autoReload: { enabled: boolean; amountUsd: number; thresholdUsd: number; failed: boolean } | null;
  // Last 30 days.
  fundedUsd30: number;
  chargedUsd30: number;
  llmCostUsd30: number;
  ledger: { id: string; kind: string; amountUsd: number; balanceUsd: number; description: string | null; createdAt: string }[];
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  hold: "Hold",
  cancelled: "Cancelled",
};

const FUNCTION_LABELS: Record<string, string> = {
  scoreSignal: "Relevance scoring",
  summarizePricingChange: "Pricing diff summary",
  extractPricingStructure: "Pricing structure extraction",
  extractCompetitorMentions: "Call mention extraction",
  suggestCompetitors: "Onboarding competitor suggestions",
  answerQuestion: "Ask",
  searchCompetitorNews: "Web search (news)",
};

export function AccountAdminView({
  account,
  accountNumber,
  competitors: initialCompetitors,
  signals: initialSignals,
  lastCrawledByCompetitor = {},
  lastCrawledOverall = null,
  llmUsageByFunction = [],
  llmUsageTotalUsd = 0,
  llmUsageWindowDays,
  connect = null,
}: {
  account: Account;
  // "Account #N" (oldest = 1), same rank shown in the accounts list —
  // undefined only if Supabase's count failed to resolve.
  accountNumber?: number;
  competitors: Competitor[];
  signals: Signal[];
  // Most recent competitor_pricing/competitor_hiring last_checked_at per
  // competitor — the two current-state tables every crawl unconditionally
  // touches, so this is "was this competitor actually crawled recently,"
  // not just "did it produce a new signal." null/missing means never
  // checked (a brand-new competitor, or one with no domain to crawl).
  lastCrawledByCompetitor?: Record<string, string | null>;
  // The most recent of the above across every competitor on this account —
  // shown next to Recrawl for an at-a-glance "is this account's data
  // fresh" without scrolling to any one competitor.
  lastCrawledOverall?: string | null;
  llmUsageByFunction?: LlmUsageByFunction[];
  llmUsageTotalUsd?: number;
  llmUsageWindowDays?: number;
  // Present only for Ripplewatch Connect accounts.
  connect?: ConnectAdminData | null;
}) {
  const router = useRouter();
  const [tier, setTier] = useState(account.tier);
  const [savingTier, setSavingTier] = useState(false);
  const [status, setStatus] = useState(account.status);
  const [savingStatus, setSavingStatus] = useState(false);
  const [demoMode, setDemoMode] = useState(account.demo_mode);
  const [savingDemoMode, setSavingDemoMode] = useState(false);
  const [startingViewAs, setStartingViewAs] = useState(false);

  async function handleViewAs() {
    setStartingViewAs(true);
    const res = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: account.id }),
    });
    if (res.ok) {
      window.open("/app/dashboard", "_blank", "noopener,noreferrer");
    }
    setStartingViewAs(false);
  }
  const [recrawling, setRecrawling] = useState(false);
  const [recrawlResult, setRecrawlResult] = useState<string | null>(null);
  const recrawlPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clears any in-flight poll on unmount so a background setInterval
  // doesn't keep firing (and calling setState on an unmounted component)
  // after someone navigates away mid-crawl.
  useEffect(() => {
    return () => {
      if (recrawlPollRef.current) clearInterval(recrawlPollRef.current);
    };
  }, []);

  const [discovering, setDiscovering] = useState(false);
  const [discoverResult, setDiscoverResult] = useState<string | null>(null);
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

  async function handleStatusChange(newStatus: string | null) {
    if (!newStatus) return;
    const previous = status;
    setStatus(newStatus as typeof status);
    setSavingStatus(true);
    const res = await fetch(`/api/admin/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setSavingStatus(false);
    if (!res.ok) setStatus(previous);
  }

  async function handleDemoModeChange(next: boolean) {
    const previous = demoMode;
    setDemoMode(next);
    setSavingDemoMode(true);
    const res = await fetch(`/api/admin/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demo_mode: next }),
    });
    setSavingDemoMode(false);
    if (!res.ok) setDemoMode(previous);
  }

  // Queued, not run synchronously — the actual checks happen afterward via
  // a background worker (every couple minutes; see the recrawl route's own
  // comment). The POST resolving only confirms the jobs were CREATED, not
  // that they're done, which used to be exactly what made this look broken:
  // the button re-enabled the instant the fetch returned, "Last crawled"
  // hadn't moved yet (the worker hadn't picked the jobs up), and clicking
  // again just queued a second full batch on top of the first. Now the
  // button stays disabled and polls the run's actual job status
  // (GET .../recrawl?runId=...) until every job either completes or
  // errors, so there's a visible "still working" state instead of a false
  // "done" the moment it's queued, and it's not possible to stack
  // duplicate batches by clicking again.
  const RECRAWL_POLL_INTERVAL_MS = 3000;
  // Generous ceiling, not an expected duration — a batch this account's
  // size should clear in well under a minute, but a slow/bot-protected
  // domain shouldn't leave the button spinning forever if something really
  // is stuck; stop polling and say so rather than spin indefinitely.
  const RECRAWL_POLL_TIMEOUT_MS = 5 * 60 * 1000;

  function pollRecrawlStatus(runId: string, total: number, startedAt: number) {
    recrawlPollRef.current = setInterval(async () => {
      const res = await fetch(`/api/admin/accounts/${account.id}/recrawl?runId=${runId}`);
      const data = await res.json().catch(() => null);
      const timedOut = Date.now() - startedAt > RECRAWL_POLL_TIMEOUT_MS;

      if (!res.ok || !data) {
        if (timedOut) {
          if (recrawlPollRef.current) clearInterval(recrawlPollRef.current);
          recrawlPollRef.current = null;
          setRecrawling(false);
          setRecrawlResult("Lost track of the crawl's progress — check back in a bit.");
        }
        return;
      }

      const { done, error: errored, finished } = data as { done: number; error: number; finished: boolean };
      if (finished || timedOut) {
        if (recrawlPollRef.current) clearInterval(recrawlPollRef.current);
        recrawlPollRef.current = null;
        setRecrawling(false);
        if (!finished) {
          setRecrawlResult(`Still running (${done + errored}/${total}) — check back in a bit.`);
          return;
        }
        setRecrawlResult(
          errored > 0
            ? `Done — ${done}/${total} succeeded, ${errored} failed.`
            : `Done — ${total} competitor${total === 1 ? "" : "s"} crawled.`
        );
        // Refreshes "Last crawled" and the rest of this server-fetched page
        // data now that the run is actually finished, instead of leaving it
        // stale until the next manual reload.
        router.refresh();
        return;
      }

      setRecrawlResult(`Crawling ${done + errored}/${total}…`);
    }, RECRAWL_POLL_INTERVAL_MS);
  }

  async function handleRecrawl() {
    if (recrawling) return;
    setRecrawling(true);
    setRecrawlResult("Queuing…");
    const res = await fetch(`/api/admin/accounts/${account.id}/recrawl`, { method: "POST" });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setRecrawling(false);
      setRecrawlResult(data?.error ?? "Failed to queue recrawl.");
      return;
    }

    const { queued, runId } = data.summary as { queued: number; runId?: string };
    if (queued === 0 || !runId) {
      setRecrawling(false);
      setRecrawlResult("No competitors to crawl.");
      return;
    }

    setRecrawlResult(`Crawling 0/${queued}…`);
    pollRecrawlStatus(runId, queued, Date.now());
  }

  async function handleDiscoverCompetitors() {
    setDiscovering(true);
    setDiscoverResult(null);
    const res = await fetch(`/api/admin/accounts/${account.id}/discover-competitors`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setDiscovering(false);
    setDiscoverResult(res.ok ? `${data.summary.suggested} suggested` : data?.error ?? "Discovery failed.");
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{account.name}</h1>
          {accountNumber ? (
            <Badge variant="outline" className="tabular-nums text-muted-foreground">
              Account #{accountNumber}
            </Badge>
          ) : null}
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
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger
              className={
                status === "active"
                  ? "h-8 w-32"
                  : "h-8 w-32 border-destructive/40 text-destructive"
              }
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {savingStatus ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Switch checked={demoMode} onCheckedChange={handleDemoModeChange} disabled={savingDemoMode} />
            Demo mode
          </label>
          {savingDemoMode ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
          {account.subscription_status ? (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {account.subscription_status}
            </Badge>
          ) : null}
          <Button variant="outline" size="sm" onClick={handleRecrawl} disabled={recrawling}>
            {recrawling ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Recrawl now
          </Button>
          <span className="text-xs text-muted-foreground" title="Most recent competitor_pricing/competitor_hiring check across every tracked competitor">
            Last crawled {timeAgo(lastCrawledOverall)}
          </span>
          {recrawlResult ? <span className="text-xs text-muted-foreground">{recrawlResult}</span> : null}
          <Button variant="outline" size="sm" onClick={handleDiscoverCompetitors} disabled={discovering}>
            {discovering ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Find new competitors
          </Button>
          {discoverResult ? <span className="text-xs text-muted-foreground">{discoverResult}</span> : null}
          <Button variant="outline" size="sm" onClick={handleViewAs} disabled={startingViewAs}>
            {startingViewAs ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
            View as (read-only)
          </Button>
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

      {connect ? (
        <Card>
          <CardHeader>
            <h2 className="font-medium">Ripplewatch Connect wallet</h2>
            <p className="text-sm text-muted-foreground">
              Prepaid balance and whether usage is covering its cost. Platform fee revenue isn&apos;t included here.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-4">
              {[
                { label: "Balance", value: `$${connect.balanceUsd.toFixed(2)}` },
                { label: "Funded, 30d", value: `$${connect.fundedUsd30.toFixed(2)}` },
                { label: "Charged for usage, 30d", value: `$${connect.chargedUsd30.toFixed(2)}` },
                {
                  label: "Usage margin, 30d",
                  value: `$${(connect.chargedUsd30 - connect.llmCostUsd30).toFixed(2)}`,
                  note: `vs $${connect.llmCostUsd30.toFixed(2)} LLM cost`,
                },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-semibold tabular-nums">{stat.value}</p>
                  {"note" in stat && stat.note ? <p className="text-xs text-muted-foreground">{stat.note}</p> : null}
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Auto-reload:{" "}
              {connect.autoReload
                ? connect.autoReload.failed
                  ? "failed, switched off"
                  : connect.autoReload.enabled
                    ? `on, adds $${connect.autoReload.amountUsd} below $${connect.autoReload.thresholdUsd}`
                    : "off"
                : "not set up"}
            </p>
            {connect.ledger.length === 0 ? (
              <p className="text-sm text-muted-foreground">No wallet activity yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>What</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {connect.ledger.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-muted-foreground">{timeAgo(row.createdAt)}</TableCell>
                      <TableCell>{row.description ?? row.kind}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.amountUsd < 0 ? "-" : "+"}${Math.abs(row.amountUsd).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">${row.balanceUsd.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {llmUsageWindowDays !== undefined ? (
        <Card>
          <CardHeader>
            <div className="flex items-baseline justify-between">
              <h2 className="font-medium">LLM cost, last {llmUsageWindowDays} days</h2>
              <span className="text-xs text-muted-foreground">Admin-only, estimated from token counts</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const tierPrice = TIERS.find((t) => t.id === account.tier)?.monthlyUsd;
              const overTierPrice = tierPrice !== undefined && llmUsageTotalUsd > tierPrice;
              return (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                  <span>
                    Estimated cost:{" "}
                    <span className={overTierPrice ? "font-semibold text-destructive" : "font-semibold"}>
                      ${llmUsageTotalUsd.toFixed(2)}
                    </span>
                  </span>
                  {tierPrice !== undefined ? (
                    <span className="text-muted-foreground">
                      vs. ${tierPrice}/mo {TIER_LABELS[account.tier] ?? account.tier} price
                    </span>
                  ) : null}
                  {overTierPrice ? (
                    <Badge variant="outline" className="border-destructive/40 text-destructive">
                      running over tier price
                    </Badge>
                  ) : null}
                </div>
              );
            })()}

            {llmUsageByFunction.length === 0 ? (
              <p className="text-sm text-muted-foreground">No LLM calls recorded for this account yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Function</TableHead>
                    <TableHead>Calls</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead>Est. cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {llmUsageByFunction.map((row) => (
                    <TableRow key={row.functionName}>
                      <TableCell className="font-medium">
                        {FUNCTION_LABELS[row.functionName] ?? row.functionName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.calls}</TableCell>
                      <TableCell className="text-muted-foreground">{row.tokens.toLocaleString()}</TableCell>
                      <TableCell>${row.costUsd.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

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
                      <p className="text-xs text-muted-foreground">
                        Last crawled {timeAgo(lastCrawledByCompetitor[competitor.id] ?? null)}
                      </p>
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
