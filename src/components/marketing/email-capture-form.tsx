"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackEvent } from "@/lib/analytics";
import { UTM_STORAGE_KEY } from "@/components/utm-capture";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailCaptureForm({
  capturePoint,
  heading = "Get the next post in your inbox",
  description = "One email when we publish something new. No spam, unsubscribe anytime.",
}: {
  capturePoint: string;
  heading?: string;
  description?: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

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
        body: JSON.stringify({ email: email.trim(), capturePoint, ...utm }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      trackEvent("generate_lead", { method: capturePoint });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-primary/30 bg-accent/40 p-6 text-center">
        <CheckCircle2 className="size-6 text-primary" />
        <p className="font-medium">You&apos;re on the list.</p>
        <p className="text-sm text-muted-foreground">We&apos;ll email you when the next post is up.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6">
      <Label htmlFor={`${capturePoint}Email`}>{heading}</Label>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          id={`${capturePoint}Email`}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="sm:flex-1"
        />
        <Button type="submit" disabled={status === "loading" || !EMAIL_PATTERN.test(email.trim())}>
          {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : null}
          Subscribe
        </Button>
      </div>
      {status === "error" ? <p className="mt-2 text-sm text-destructive">Something went wrong. Try again.</p> : null}
    </form>
  );
}
