"use client";

import { useState } from "react";
import { Copy, Check, Loader2, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";

type Referral = { id: string; referred_at: string; qualified_at: string | null };

export function ReferralCodeManager({
  initialCode,
  referrals,
}: {
  initialCode: string | null;
  referrals: Referral[];
}) {
  const [code, setCode] = useState(initialCode);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const link = code && typeof window !== "undefined" ? `${window.location.origin}/refer?ref=${code}` : "";

  async function generateCode() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/settings/referral-code", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate a referral link.");
      setCode(data.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate a referral link.");
    } finally {
      setGenerating(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const qualified = referrals.filter((r) => r.qualified_at).length;
  const pending = referrals.length - qualified;

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center gap-2">
        <Gift className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">Refer & earn</h3>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Share your link: the company you refer gets 2 months free the moment they sign up, and you get 2
        months free of your own once they&apos;ve stuck around as a customer for 60 days. Multiple referrals
        stack.
      </p>

      {code ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-3">
          <code className="flex-1 truncate text-sm">{link}</code>
          <button
            type="button"
            onClick={copyLink}
            className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : (
        <Button type="button" size="sm" className="mt-3" onClick={generateCode} disabled={generating}>
          {generating ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Get my referral link
        </Button>
      )}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

      {referrals.length > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{referrals.length}</span> referral
          {referrals.length === 1 ? "" : "s"} sent -{" "}
          <span className="font-medium text-emerald-600 dark:text-emerald-400">{qualified} confirmed</span>
          {pending > 0 ? (
            <>
              , <span className="font-medium">{pending} pending</span> (60-day window)
            </>
          ) : null}
          .
        </p>
      ) : null}
    </div>
  );
}
