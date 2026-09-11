"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, DollarSign, Loader2, RefreshCw, Search, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DemoLink } from "@/components/marketing/demo-link";
import { trackEvent } from "@/lib/analytics";
import { UTM_STORAGE_KEY } from "@/components/utm-capture";
import { BILLING_MODEL_LABELS } from "@/lib/billing-model";
import type { BillingModel } from "@/lib/supabase/types";

type SnapshotResult = {
  domain: string;
  reachable: boolean;
  title: string | null;
  pricing: {
    billingModel: BillingModel;
    publiclyPriced: boolean;
    note: string | null;
    tiers: { name: string; price: number | null; price_period: string | null; features: string[] }[];
  } | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CompetitorSnapshotTool() {
  const [email, setEmail] = useState("");
  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<SnapshotResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    let utm: Record<string, string> = {};
    try {
      const raw = localStorage.getItem(UTM_STORAGE_KEY);
      if (raw) utm = JSON.parse(raw);
    } catch {
      // ignore malformed/blocked storage
    }

    try {
      const res = await fetch("/api/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), domain: domain.trim(), ...utm }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setStatus("error");
        return;
      }
      trackEvent("generate_lead", { method: "snapshot" });
      setResult(data);
      setStatus("done");
    } catch {
      setError("Something went wrong. Try again.");
      setStatus("error");
    }
  }

  function tryAnother() {
    setResult(null);
    setStatus("idle");
    setDomain("");
  }

  if (status === "done" && result) {
    const cheapestTier = result.pricing?.tiers.find((t) => t.price !== null) ?? null;

    return (
      <div className="animate-in fade-in zoom-in-95 space-y-6 duration-500">
        <div className="rounded-2xl border border-primary/25 bg-card p-6 sm:p-8">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Live snapshot</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight">{result.domain}</h3>

          {result.title ? <p className="mt-2 text-sm text-muted-foreground">&ldquo;{result.title}&rdquo;</p> : null}

          {result.pricing ? (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-secondary/30 p-4">
              <DollarSign className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="text-sm">
                <p className="font-medium">{BILLING_MODEL_LABELS[result.pricing.billingModel]}</p>
                {cheapestTier ? (
                  <p className="mt-0.5 text-muted-foreground">
                    From ${cheapestTier.price}
                    {cheapestTier.price_period ? `/${cheapestTier.price_period}` : ""} ({cheapestTier.name})
                  </p>
                ) : (
                  <p className="mt-0.5 text-muted-foreground">
                    {result.pricing.publiclyPriced ? "Pricing is public, no numbers pulled yet." : "Pricing isn't public (custom/sales-led)."}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              {result.reachable
                ? "Found the site, but couldn't confirm a public pricing page from a guess at the URL. Ripplewatch's real onboarding lets you point it at the right one."
                : "This one blocked our one-time check, some sites do. Once you're tracking a competitor for real, Ripplewatch retries on a schedule instead of giving up after one try."}
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-accent/40 p-6 text-center">
          <Sparkles className="size-6 text-primary" />
          <p className="max-w-md text-sm text-muted-foreground">
            This was one look, right now. Ripplewatch checks this (and their hiring, product changes, and news)
            on an ongoing basis, and scores what changes against your own positioning and lost-deal reasons, not
            just this one competitor.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Link href="/pricing" className={buttonVariants()}>
              Start tracking your competitors
              <ArrowRight className="size-4" />
            </Link>
            <DemoLink variant="button" />
          </div>
        </div>

        <button
          type="button"
          onClick={tryAnother}
          className="mx-auto flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="size-3.5" />
          Try another competitor
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-border bg-card p-6 sm:p-8"
    >
      <div className="space-y-2">
        <Label htmlFor="snapshotDomain">A competitor&apos;s domain</Label>
        <Input
          id="snapshotDomain"
          required
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="acme.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="snapshotEmail">Your email</Label>
        <Input
          id="snapshotEmail"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button
        type="submit"
        className="w-full"
        disabled={status === "loading" || !EMAIL_PATTERN.test(email.trim()) || !domain.trim()}
      >
        {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
        {status === "loading" ? "Checking..." : "See their snapshot"}
      </Button>
    </form>
  );
}
