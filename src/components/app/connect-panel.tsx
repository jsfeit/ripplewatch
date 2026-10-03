"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Copy, Check, CreditCard, Loader2, Upload, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectCheckoutModal } from "@/components/app/connect-checkout-modal";
import { ConnectFundingPicker, fundingFromPicker } from "@/components/app/connect-funding-picker";
import { IntegrationConnector } from "@/components/app/integration-connector";
import { SlackDigestSchedule } from "@/components/app/slack-digest-schedule";
import { CONNECT_BASE_FEE_USD, CONNECT_DEFAULT_RELOAD_USD } from "@/lib/connect-pricing";
import { CONNECT_MCP_URL, CONNECT_NAME } from "@/lib/connect";
import { timeAgo } from "@/lib/date";
import { cn } from "@/lib/utils";
import { ONBOARDING_VALUE } from "@/lib/onboarding-value";
import { formatWinLossImportMessage, type ImportMessageData } from "@/lib/win-loss-import";

export type ConnectLedgerRow = {
  id: string;
  kind: string;
  amountUsd: number;
  balanceUsd: number;
  description: string | null;
  createdAt: string;
};

export type ConnectFirstLook = {
  companyName: string;
  crawl: { state: "none" | "running" | "ready"; done: number; total: number };
  topSignals: { competitor: string | null; title: string; why: string | null; date: string }[];
  starterPrompts: string[];
};

const money = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// The Connect tab in Settings: subscription state, the prepaid balance and
// adding to it, how to connect an assistant, and what has been charged.
export type AutoReloadSettings = { enabled: boolean; amountUsd: number; thresholdUsd: number; failed: boolean };

export function ConnectPanel({
  balanceUsd,
  hasSubscription,
  ledger,
  autoReload,
  mcpLastConnectedAt,
  slackConnected,
  timezone,
  slackDigestDay,
  slackDigestHour,
  hasPositioning,
  competitorCount,
  firstLook,
  disconnectIntegrationAction,
}: {
  balanceUsd: number;
  hasSubscription: boolean;
  ledger: ConnectLedgerRow[];
  autoReload: AutoReloadSettings;
  // Set from an actually-authenticated MCP request (see /api/mcp/route.ts),
  // never just from copying the URL below — so this reflects whether an
  // assistant has really connected, not whether someone glanced at this page.
  mcpLastConnectedAt: string | null;
  slackConnected: boolean;
  timezone: string;
  slackDigestDay: number;
  slackDigestHour: number;
  hasPositioning: boolean;
  competitorCount: number;
  firstLook: ConnectFirstLook;
  disconnectIntegrationAction: (formData: FormData) => void;
}) {
  const router = useRouter();
  const [picker, setPicker] = useState<number | "custom">(CONNECT_DEFAULT_RELOAD_USD);
  const [custom, setCustom] = useState("");
  const [checkout, setCheckout] = useState<{ kind: "signup" | "topup"; fundingUsd: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState("");
  const [justPaid, setJustPaid] = useState(false);
  const [reload, setReload] = useState(autoReload);
  const [savingReload, setSavingReload] = useState(false);
  const winLossFileInputRef = useRef<HTMLInputElement>(null);
  const [winLossUploading, setWinLossUploading] = useState(false);
  const [winLossMessage, setWinLossMessage] = useState<string | null>(null);

  async function handleWinLossFile(file: File) {
    setWinLossUploading(true);
    setWinLossMessage(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/competitors/win-loss/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setWinLossMessage(formatWinLossImportMessage("Upload", data as ImportMessageData, false));
    } catch (err) {
      setWinLossMessage(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setWinLossUploading(false);
      if (winLossFileInputRef.current) winLossFileInputRef.current.value = "";
    }
  }

  async function saveReload(next: Partial<{ autoReloadEnabled: boolean; reloadAmountUsd: number; reloadThresholdUsd: number }>) {
    setSavingReload(true);
    setError("");
    const res = await fetch("/api/connect/wallet", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const data = await res.json().catch(() => ({}));
    setSavingReload(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save that.");
      return;
    }
    setReload((r) => ({
      enabled: next.autoReloadEnabled ?? r.enabled,
      amountUsd: next.reloadAmountUsd ?? r.amountUsd,
      thresholdUsd: next.reloadThresholdUsd ?? r.thresholdUsd,
      failed: next.autoReloadEnabled ? false : r.failed,
    }));
  }

  const funding = fundingFromPicker(picker, custom);

  // Returning from Stripe Checkout: the webhook that credits the balance can
  // land a moment after the redirect, so say so and refresh a couple of times.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("checkout") !== "success") return;
    // One-time read of the return URL on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJustPaid(true);
    const timers = [2500, 6000, 12000].map((ms) => setTimeout(() => router.refresh(), ms));
    return () => timers.forEach(clearTimeout);
  }, [router]);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(CONNECT_MCP_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked: the URL is selectable on screen
    }
  }

  async function openPortal() {
    setPortalLoading(true);
    setError("");
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setPortalLoading(false);
    if (res.ok && data.url) window.location.href = data.url;
    else setError(data.error ?? "Could not open billing.");
  }

  const connected = Boolean(mcpLastConnectedAt);

  const connectAssistantCard = (
    <div id="connect-assistant" className="scroll-mt-6 rounded-xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Connect your assistant</h2>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            connected ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
          )}
        >
          {connected ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}
          {connected ? `Connected · active ${timeAgo(mcpLastConnectedAt!)}` : "Not connected yet"}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {connected
          ? "Your assistant is talking to Ripplewatch. Add it to another one (or disconnect an old one) from the Developer tab."
          : "This is the one thing left to do. Three steps, about a minute."}
      </p>

      {connected ? (
        <div className="mt-3 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs">
            {CONNECT_MCP_URL}
          </code>
          <Button variant="outline" size="sm" onClick={copyUrl}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      ) : (
        <ol className="mt-4 space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              1
            </span>
            <div className="min-w-0 flex-1">
              <p>Copy this URL.</p>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs">
                  {CONNECT_MCP_URL}
                </code>
                <Button variant="outline" size="sm" onClick={copyUrl}>
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              2
            </span>
            <p>
              In Claude, go to Settings → Connectors → Add custom connector. In ChatGPT, go to Settings → Connectors →
              Advanced → Add custom connector.
            </p>
          </li>
          <li className="flex gap-3">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              3
            </span>
            <p>Paste the URL, then sign in and approve when it asks. Come back here and this card updates itself.</p>
          </li>
        </ol>
      )}
    </div>
  );

  const slackCard = (
    <div id="connect-slack" className="scroll-mt-6 rounded-xl border border-border bg-card p-6">
      <h2 className="text-base font-semibold">Slack delivery</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Get a weekly Momentum digest in a channel, on top of asking your assistant directly.
      </p>
      <div className="mt-3">
        <IntegrationConnector
          name="Slack"
          description="Deliver a weekly digest to a channel"
          connected={slackConnected}
          connectHref="/api/integrations/slack/connect"
          provider="slack"
          disconnectAction={disconnectIntegrationAction}
        />
      </div>
      {slackConnected ? (
        <div className="mt-4">
          <SlackDigestSchedule initialTimezone={timezone} initialDay={slackDigestDay} initialHour={slackDigestHour} />
        </div>
      ) : null}
    </div>
  );

  const winLossCard = (
    <div id="connect-win-loss" className="scroll-mt-6 rounded-xl border border-border bg-card p-6">
      <h2 className="text-base font-semibold">Win/loss data</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload a CRM export or a plain list of deals and we&apos;ll pull out the win/loss and churn reasons for each
        competitor. You can also just tell your assistant directly as deals happen.
      </p>
      {competitorCount === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Add a competitor first, then come back to upload here.</p>
      ) : (
        <div className="mt-3">
          <input
            ref={winLossFileInputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleWinLossFile(file);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => winLossFileInputRef.current?.click()}
            disabled={winLossUploading}
          >
            {winLossUploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            Upload a file
          </Button>
          {winLossUploading ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Reading it now. A large file can take a minute or two.
            </p>
          ) : winLossMessage ? (
            <p className="mt-2 text-xs text-muted-foreground">{winLossMessage}</p>
          ) : null}
        </div>
      )}
    </div>
  );

  // While the very first competitor check runs, say so (a brand-new account
  // with an empty page and no explanation reads as broken) and keep the page
  // fresh until it finishes. Voiced as the assistant, since that's who the
  // customer will actually be talking to.
  const crawlRunning = firstLook.crawl.state === "running";
  // Scoring finishes a little after the crawl itself does, so a "ready" check
  // with no findings yet gets a few more refreshes before settling on "nothing
  // moved".
  const awaitingFindings = firstLook.crawl.state === "ready" && firstLook.topSignals.length === 0;
  useEffect(() => {
    if (!crawlRunning && !awaitingFindings) return;
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      router.refresh();
      if (!crawlRunning && ticks >= 4) clearInterval(timer);
    }, 8000);
    return () => clearInterval(timer);
  }, [crawlRunning, awaitingFindings, router]);

  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  async function copyPrompt(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPrompt(text);
      setTimeout(() => setCopiedPrompt(null), 1800);
    } catch {
      // clipboard blocked: the prompt is still readable on screen
    }
  }

  const firstLookCard = (
    <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-6">
      <h2 className="text-base font-semibold">
        {crawlRunning ? `I'm looking into ${firstLook.companyName}'s competitors now` : `Here's where we are, ${firstLook.companyName}`}
      </h2>
      {crawlRunning ? (
        <div className="mt-2">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Checked {firstLook.crawl.done} of {firstLook.crawl.total}. This usually takes a few minutes, and this page
            updates by itself.
          </p>
        </div>
      ) : firstLook.topSignals.length > 0 ? (
        <div className="mt-2">
          <p className="text-sm text-muted-foreground">The first things worth your attention:</p>
          <ul className="mt-2 space-y-2 text-sm">
            {firstLook.topSignals.map((s, i) => (
              <li key={i}>
                <span className="font-medium">{s.competitor ? `${s.competitor}: ` : ""}</span>
                {s.title}
                {s.why ? <span className="block text-xs text-muted-foreground">{s.why}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          The first check is done and nothing big has moved. That&apos;s normal. I&apos;ll flag it as soon as something does.
        </p>
      )}

      <p className="mt-4 text-sm font-medium">Try asking your assistant</p>
      <ul className="mt-2 space-y-1.5">
        {firstLook.starterPrompts.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              onClick={() => void copyPrompt(prompt)}
              className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-left text-sm hover:border-primary/50"
            >
              <span>{prompt}</span>
              {copiedPrompt === prompt ? (
                <Check className="size-3.5 shrink-0 text-primary" />
              ) : (
                <Copy className="size-3.5 shrink-0 text-muted-foreground" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  // The one obvious step after checkout is connecting an assistant — nothing
  // else here is. This card names everything else that's still worth doing
  // and how, then disappears once it's all done rather than lingering as
  // permanent clutter for an account that's fully set up.
  const checklistItems = [
    {
      label: "Connect your assistant",
      value: ONBOARDING_VALUE.connect,
      done: connected,
      hint: <a href="#connect-assistant" className="underline underline-offset-2 hover:text-foreground">See steps below</a>,
    },
    {
      label: "Tell it about your business",
      value: ONBOARDING_VALUE.business,
      done: hasPositioning,
      hint: `Ask it: "We help [who] do [what]. Our main competitors are..."`,
    },
    {
      label: "Add your competitors",
      value: ONBOARDING_VALUE.competitors,
      done: competitorCount > 0,
      hint: `Ask it: "Start tracking [competitor name], [their website]."`,
    },
    {
      label: "Connect Slack (optional)",
      value: ONBOARDING_VALUE.slack,
      done: slackConnected,
      hint: <a href="#connect-slack" className="underline underline-offset-2 hover:text-foreground">See below</a>,
    },
  ];
  const doneCount = checklistItems.filter((i) => i.done).length;

  const checklistCard =
    hasSubscription && doneCount < checklistItems.length ? (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Getting the most out of {CONNECT_NAME}</h2>
          <span className="text-xs text-muted-foreground">
            {doneCount} of {checklistItems.length} done
          </span>
        </div>
        <ul className="mt-4 space-y-3 text-sm">
          {checklistItems.map((item) => (
            <li key={item.label} className="flex items-start gap-3">
              {item.done ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <p className={item.done ? "text-muted-foreground line-through" : ""}>{item.label}</p>
                {item.done ? (
                  <p className="mt-0.5 text-xs text-primary">{item.value.unlocked(competitorCount)}</p>
                ) : (
                  <>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.value.unlocks}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.hint}</p>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <div className="min-w-0 space-y-6">
      {justPaid ? (
        <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>Payment received. Your balance can take a few seconds to show up here.</p>
        </div>
      ) : null}

      {hasSubscription && competitorCount > 0 ? firstLookCard : null}
      {checklistCard}
      {hasSubscription ? connectAssistantCard : null}
      {hasSubscription ? winLossCard : null}
      {hasSubscription ? slackCard : null}

      {!hasSubscription ? (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Start {CONNECT_NAME}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ${CONNECT_BASE_FEE_USD}/month for the platform, plus a prepaid balance that answers and competitor
            monitoring draw from. Pick your opening balance.
          </p>
          <div className="mt-4 max-w-md">
            <ConnectFundingPicker value={picker} onChange={setPicker} custom={custom} onCustomChange={setCustom} />
          </div>
          <Button
            className="mt-5"
            disabled={!funding}
            onClick={() => funding && setCheckout({ kind: "signup", fundingUsd: funding })}
          >
            <CreditCard className="size-4" />
            {funding ? `Pay $${CONNECT_BASE_FEE_USD + funding} today` : "Choose an amount"}
          </Button>
          {funding ? (
            <p className="mt-2 text-xs text-muted-foreground">
              ${CONNECT_BASE_FEE_USD} platform fee + ${funding} added to your balance. Tax is added at checkout.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Wallet className="size-4" /> Usage balance
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">{money(balanceUsd)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Answers and competitor monitoring draw from this. At zero, they pause until you add funds.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={openPortal} disabled={portalLoading}>
              {portalLoading ? <Loader2 className="size-3.5 animate-spin" /> : <CreditCard className="size-3.5" />}
              Manage billing
            </Button>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <p className="text-sm font-medium">Add funds</p>
            <div className="mt-3 max-w-md">
              <ConnectFundingPicker value={picker} onChange={setPicker} custom={custom} onCustomChange={setCustom} />
            </div>
            <Button
              className="mt-4"
              size="sm"
              disabled={!funding}
              onClick={() => funding && setCheckout({ kind: "topup", fundingUsd: funding })}
            >
              {funding ? `Add $${funding}` : "Choose an amount"}
            </Button>
          </div>
        </div>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {hasSubscription ? (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold">Auto-reload</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep your balance topped up automatically so answers and monitoring never pause. We charge your saved card
            when the balance drops below the level you choose.
          </p>
          {reload.failed ? (
            <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Your last auto-reload didn&apos;t go through, so it&apos;s switched off. Update your card under Manage
              billing, then turn it back on.
            </p>
          ) : null}
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={reload.enabled}
              disabled={savingReload}
              onChange={(e) => void saveReload({ autoReloadEnabled: e.target.checked })}
            />
            Auto-reload my balance
          </label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Add this much</span>
              <select
                value={reload.amountUsd}
                disabled={savingReload}
                onChange={(e) => void saveReload({ reloadAmountUsd: Number(e.target.value) })}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {[50, 100, 250, 500].map((n) => (
                  <option key={n} value={n}>
                    ${n}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">When the balance drops below</span>
              <select
                value={reload.thresholdUsd}
                disabled={savingReload}
                onChange={(e) => void saveReload({ reloadThresholdUsd: Number(e.target.value) })}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {[5, 10, 25, 50].map((n) => (
                  <option key={n} value={n}>
                    ${n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Balance history</h2>
        {ledger.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing yet. Funding and usage will show up here.</p>
        ) : (
          <div className="mt-3 max-w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">When</th>
                  <th className="pb-2 font-medium">What</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                  <th className="pb-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ledger.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap py-2 pr-3 text-muted-foreground">{timeAgo(row.createdAt)}</td>
                    <td className="py-2 pr-3">{row.description ?? row.kind}</td>
                    <td className={`whitespace-nowrap py-2 pr-3 text-right tabular-nums ${row.amountUsd < 0 ? "" : "text-primary"}`}>
                      {row.amountUsd < 0 ? money(row.amountUsd) : `+${money(row.amountUsd)}`}
                    </td>
                    <td className="whitespace-nowrap py-2 text-right tabular-nums text-muted-foreground">{money(row.balanceUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {checkout ? (
        <ConnectCheckoutModal
          open
          onOpenChange={(open) => !open && setCheckout(null)}
          kind={checkout.kind}
          fundingUsd={checkout.fundingUsd}
        />
      ) : null}
    </div>
  );
}
