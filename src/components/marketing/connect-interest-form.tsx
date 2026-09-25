"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackEvent } from "@/lib/analytics";
import { UTM_STORAGE_KEY } from "@/components/utm-capture";
import { CONNECT_ASSISTANTS, CONNECT_NAME, type ConnectAssistant } from "@/lib/connect";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Early-access request for Connect. Shared by the /connect page and the
// onboarding "use my AI assistant" path so both record the same thing
// (a lead tagged capture_point "connect" with the assistant they use).
// Nothing here creates an account: Connect isn't purchasable yet, and the
// confirmation says so, with the one way to get it today (Plus).
export function ConnectInterestForm({ source }: { source: "connect_page" | "onboarding" }) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [assistant, setAssistant] = useState<ConnectAssistant>("Claude");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");

    let utm: Record<string, string> = {};
    try {
      const raw = localStorage.getItem(UTM_STORAGE_KEY);
      if (raw) utm = JSON.parse(raw);
    } catch {
      // ignore malformed/blocked storage
    }

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          company: company.trim(),
          capturePoint: "connect",
          metadata: { assistant, source },
          ...utm,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Try again.");
        setStatus("idle");
        return;
      }
      trackEvent("generate_lead", { method: "connect" });
      setStatus("done");
    } catch {
      setError("Something went wrong. Try again.");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="space-y-4 rounded-2xl border border-primary/25 bg-card p-6 sm:p-8">
        <p className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="size-5 text-primary" />
          You&apos;re on the list
        </p>
        <p className="text-sm text-muted-foreground">
          We&apos;ll email {email.trim()} when {CONNECT_NAME} opens, with pricing before you decide anything.
        </p>
        <div className="rounded-xl border border-border bg-secondary/40 p-4 text-sm">
          <p className="font-medium">Want to use it today?</p>
          <p className="mt-1 text-muted-foreground">
            Connecting Claude or ChatGPT is included in the Plus plan right now, alongside the dashboard.
          </p>
          <Link
            href="/onboarding?plan=plus&period=monthly&path=dashboard"
            className={buttonVariants({ size: "sm", className: "mt-3" })}
          >
            Start with Plus <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form id="early-access" onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="space-y-2">
        <Label htmlFor="connectEmail">Work email</Label>
        <Input
          id="connectEmail"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="connectCompany">Company (optional)</Label>
        <Input id="connectCompany" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="connectAssistant">Which assistant do you use most?</Label>
        <select
          id="connectAssistant"
          value={assistant}
          onChange={(e) => setAssistant(e.target.value as ConnectAssistant)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
        >
          {CONNECT_ASSISTANTS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={status === "sending" || !EMAIL_PATTERN.test(email.trim())}>
        {status === "sending" ? <Loader2 className="size-4 animate-spin" /> : null}
        Request early access
      </Button>
      <p className="text-center text-xs text-muted-foreground">No payment, no account. We&apos;ll email when it opens.</p>
    </form>
  );
}
