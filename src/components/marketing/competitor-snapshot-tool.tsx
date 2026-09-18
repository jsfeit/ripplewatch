"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Briefcase, DollarSign, Loader2, RefreshCw, Search, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DemoLink } from "@/components/marketing/demo-link";
import { trackEvent } from "@/lib/analytics";
import { UTM_STORAGE_KEY } from "@/components/utm-capture";
import { BILLING_MODEL_LABELS } from "@/lib/billing-model";
import type { SnapshotResult } from "@/lib/snapshot";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CompetitorSnapshotTool() {
  const [email, setEmail] = useState("");
  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<SnapshotResult | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void runSnapshot(domain.trim());
  }

  // Also used by the "did you mean" buttons, which re-run the same email
  // against a different domain.
  async function runSnapshot(domainToCheck: string) {
    setDomain(domainToCheck);
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
        body: JSON.stringify({ email: email.trim(), domain: domainToCheck, ...utm }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setStatus("error");
        return;
      }
      trackEvent("generate_lead", { method: "snapshot" });
      setResult(data);
      setSubmittedEmail(email.trim());
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
    return (
      <div className="animate-in fade-in zoom-in-95 space-y-6 duration-500">
        <div className="rounded-2xl border border-primary/25 bg-card p-6 sm:p-8">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Live snapshot</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight">{result.domain}</h3>

          {result.title ? <p className="mt-2 text-sm text-muted-foreground">&ldquo;{result.title}&rdquo;</p> : null}

          <div className="mt-4 space-y-3">
            <PricingBlock result={result} />
            <HiringBlock result={result} />
          </div>

          {result.alternates.length > 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm">
              <p className="font-medium">Did you mean a different company?</p>
              <p className="mt-0.5 text-muted-foreground">
                Different companies often share a name across domain endings. We also found:
              </p>
              <ul className="mt-3 space-y-2">
                {result.alternates.map((alt) => (
                  <li key={alt.domain} className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="font-medium">{alt.domain}</span>
                      <span className="block truncate text-muted-foreground">{alt.title}</span>
                    </span>
                    <Button type="button" size="sm" variant="outline" onClick={() => void runSnapshot(alt.domain)}>
                      Try this one
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.needsManualCheck ? (
            <p className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm">
              We couldn&apos;t read this one automatically, so we&apos;ll take a manual look and email what we find to{" "}
              <span className="font-medium">{submittedEmail}</span>.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-accent/40 p-6 text-center">
          <Sparkles className="size-6 text-primary" />
          <p className="max-w-md text-sm text-muted-foreground">
            This was one look, right now. Ripplewatch keeps checking their pricing and hiring, plus product changes
            and news, and scores what changes against your own positioning and lost-deal reasons, not just this one
            competitor.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Link href="/pricing" className={buttonVariants()}>
              Start tracking your competitors
              <ArrowRight className="size-4" />
            </Link>
            <DemoLink variant="button" />
          </div>
          <p className="text-xs text-muted-foreground">
            Not sure this is even your biggest gap?{" "}
            <Link href="/competitive-intelligence-quiz" className="font-medium text-primary hover:underline">
              Take the 5-question maturity quiz
            </Link>
            .
          </p>
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

// "20250912143000" (Wayback's timestamp shape) -> "Sep 2025"
function formatArchiveDate(timestamp: string | null): string | null {
  if (!timestamp || timestamp.length < 6) return null;
  const date = new Date(`${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function InfoRow({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border bg-secondary/30 p-4">
      <span className="mt-0.5 shrink-0 text-primary">{icon}</span>
      <div className="text-sm">
        <p className="font-medium">{title}</p>
        <div className="mt-0.5 space-y-1 text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

function PricingBlock({ result }: { result: SnapshotResult }) {
  const { pricing, domain } = result;
  const icon = <DollarSign className="size-4" />;
  const archivedNote =
    pricing.source === "wayback" ? (
      <p>
        Read from an archived copy of their pricing page
        {formatArchiveDate(pricing.capturedAt) ? ` (${formatArchiveDate(pricing.capturedAt)})` : ""}, so it may be out
        of date. Their live page wouldn&apos;t load for us.
      </p>
    ) : null;

  if (pricing.state === "public") {
    const cheapest = pricing.tiers.find((t) => t.price !== null);
    return (
      <InfoRow icon={icon} title={pricing.billingModel ? BILLING_MODEL_LABELS[pricing.billingModel] : "Public pricing"}>
        {cheapest ? (
          <p>
            From ${cheapest.price}
            {cheapest.price_period ? `/${cheapest.price_period}` : ""} ({cheapest.name})
          </p>
        ) : null}
        {archivedNote}
      </InfoRow>
    );
  }

  if (pricing.state === "public_no_numbers") {
    return (
      <InfoRow icon={icon} title="Public pricing page">
        <p>They publish pricing, but we couldn&apos;t pull specific numbers from it.</p>
        {archivedNote}
      </InfoRow>
    );
  }

  if (pricing.state === "sales_led") {
    return (
      <InfoRow icon={icon} title="Sales-led pricing">
        <p>
          {domain}{" "}
          doesn&apos;t publish prices, you have to talk to their sales team. That&apos;s a real finding:
          Ripplewatch watches their pricing and packaging pages and flags it when that changes, like a tier
          appearing or a price going public.
        </p>
        {archivedNote}
      </InfoRow>
    );
  }

  if (pricing.state === "unreadable") {
    return (
      <InfoRow icon={icon} title="Pricing: page found, couldn't read it">
        <p>
          We found their pricing page but couldn&apos;t turn it into a clear read, which usually means the prices load
          in a way a one-time check can&apos;t see. Ripplewatch&apos;s scheduled checks handle more of these.
        </p>
      </InfoRow>
    );
  }

  if (pricing.state === "unreachable") {
    return (
      <InfoRow icon={icon} title="Pricing: site blocked our check">
        <p>
          Some sites block automated requests, and this looks like one. Once you&apos;re tracking a competitor for
          real, Ripplewatch retries on a schedule and falls back to archived copies instead of giving up after one
          try.
        </p>
      </InfoRow>
    );
  }

  return (
    <InfoRow icon={icon} title="Pricing: no readable page found">
      <p>
        We reached their site but couldn&apos;t find a pricing page we could read. In Ripplewatch you can point it at
        the exact page.
      </p>
    </InfoRow>
  );
}

function HiringBlock({ result }: { result: SnapshotResult }) {
  const { hiring } = result;
  const icon = <Briefcase className="size-4" />;

  if (hiring.status === "ok") {
    const mix = hiring.departments.map((d) => `${d.name} (${d.count})`).join(", ");
    return (
      <InfoRow icon={icon} title={`${hiring.openRoles} open role${hiring.openRoles === 1 ? "" : "s"}`}>
        {mix ? <p>Mostly {mix}.</p> : null}
      </InfoRow>
    );
  }

  if (hiring.status === "page_only") {
    return (
      <InfoRow icon={icon} title="Hiring: careers page found">
        <p>
          We found their careers page but couldn&apos;t read a structured list of open roles from it. Ripplewatch
          tracks changes to it over time.
        </p>
      </InfoRow>
    );
  }

  return (
    <InfoRow icon={icon} title="Hiring: no job board found">
      <p>We couldn&apos;t find a careers page or public job board for them.</p>
    </InfoRow>
  );
}
