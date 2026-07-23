"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, company }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setError("Something went wrong. Try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-primary/30 bg-accent/40 p-8 text-center">
        <CheckCircle2 className="size-8 text-primary" />
        <p className="font-medium">You&apos;re on the list.</p>
        <p className="text-sm text-muted-foreground">
          We&apos;re onboarding teams in small batches — we&apos;ll reach out at {email}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6">
      <div className="space-y-2">
        <Label htmlFor="company">Company name</Label>
        <Input
          id="company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Acme Inc."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={status === "loading"}>
        {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : null}
        Join the waitlist
      </Button>
    </form>
  );
}
