"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Check, CreditCard, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectCheckoutModal } from "@/components/app/connect-checkout-modal";
import { ConnectFundingPicker, fundingFromPicker } from "@/components/app/connect-funding-picker";
import { CONNECT_BASE_FEE_USD, CONNECT_DEFAULT_RELOAD_USD } from "@/lib/connect-pricing";
import { CONNECT_MCP_URL, CONNECT_NAME } from "@/lib/connect";
import { timeAgo } from "@/lib/date";

export type ConnectLedgerRow = {
  id: string;
  kind: string;
  amountUsd: number;
  balanceUsd: number;
  description: string | null;
  createdAt: string;
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
}: {
  balanceUsd: number;
  hasSubscription: boolean;
  ledger: ConnectLedgerRow[];
  autoReload: AutoReloadSettings;
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

  return (
    <div className="min-w-0 space-y-6">
      {justPaid ? (
        <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>Payment received. Your balance can take a few seconds to show up here.</p>
        </div>
      ) : null}

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
        <h2 className="text-base font-semibold">Connect your assistant</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          In Claude or ChatGPT, add a custom connector with this URL, then sign in and approve. Apps you approve appear
          under the Developer tab, where you can disconnect them.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs">
            {CONNECT_MCP_URL}
          </code>
          <Button variant="outline" size="sm" onClick={copyUrl}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

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
