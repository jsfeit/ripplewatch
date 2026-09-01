"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function AffiliateApplicationForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whyGoodFit, setWhyGoodFit] = useState("");
  const [channels, setChannels] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/affiliates/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, whyGoodFit, channels }),
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
        <p className="font-medium">Application received.</p>
        <p className="text-sm text-muted-foreground">We&apos;ll reach out at {email} if it&apos;s a fit.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="whyGoodFit">Why would you be a good fit?</Label>
        <Textarea
          id="whyGoodFit"
          required
          rows={3}
          value={whyGoodFit}
          onChange={(e) => setWhyGoodFit(e.target.value)}
          placeholder="e.g. I write about competitive intelligence and sales enablement for a newsletter of 8,000 B2B marketers."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="channels">What channels would you promote us through?</Label>
        <Textarea
          id="channels"
          required
          rows={3}
          value={channels}
          onChange={(e) => setChannels(e.target.value)}
          placeholder="e.g. Newsletter, YouTube channel, a comparison/review site, an agency roster..."
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={status === "loading"}>
        {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : null}
        Apply
      </Button>
    </form>
  );
}
