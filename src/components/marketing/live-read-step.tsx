"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersonalReadCard } from "@/components/app/personal-read-card";
import { saveIntro, type ConnectIntro, type IntroRead } from "@/lib/connect-intro";
import { trackEvent } from "@/lib/analytics";

type Result = { read: IntroRead; competitorName: string; evidence: string[] };

// Before account and payment: tell it what you sell, name one competitor, and
// get a real read on them. It is the product doing its job once, for free, so
// the price that follows is for something already seen. Skippable, and any
// failure (a cap, a slow site, no answer) just lets the visitor carry on.
export function LiveReadStep({
  initialCompany,
  onDone,
  onSkip,
}: {
  initialCompany: string;
  onDone: (companyName: string) => void;
  onSkip: (companyName: string) => void;
}) {
  const [companyName, setCompanyName] = useState(initialCompany);
  const [positioning, setPositioning] = useState("");
  const [icp, setIcp] = useState("");
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    trackEvent("live_read_viewed");
  }, []);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const canRun = positioning.trim().length >= 3 && domain.trim().length >= 3 && !busy;

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!canRun) return;
    setSeconds(0);
    setBusy(true);
    setError("");
    trackEvent("live_read_requested");
    try {
      const res = await fetch("/api/onboarding/live-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, positioning, icp, domain }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't run that just now. You can skip this and sign up.");
        return;
      }
      if (!data.read) {
        setError(
          data.reason === "busy"
            ? "The free reads are busy right now. Skip ahead, and your first read is one of the first things you can ask for."
            : "I couldn't get a read on that one. Try another competitor, or skip ahead."
        );
        return;
      }
      const competitor = data.competitor as { name: string; domain: string };
      const intro: ConnectIntro = {
        companyName: companyName.trim(),
        positioning: positioning.trim(),
        icp: icp.trim(),
        competitor,
        read: data.read,
        evidence: data.evidence ?? [],
        readId: typeof data.readId === "string" ? data.readId : null,
      };
      saveIntro(intro);
      trackEvent("live_read_shown", { confidence: data.read.confidence });
      setResult({ read: data.read, competitorName: competitor.name, evidence: intro.evidence });
    } catch {
      setError("Couldn't run that just now. You can skip this and sign up.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-5">
        <PersonalReadCard competitorName={result.competitorName} read={result.read} evidence={result.evidence} />
        <p className="text-sm text-muted-foreground">
          That was one competitor, once. Ripplewatch keeps watching, scores every move against your deals, and answers
          in Claude or ChatGPT.
        </p>
        <Button className="w-full" onClick={() => onDone(companyName.trim())}>
          Set up my account
          <ArrowRight className="size-4" />
        </Button>
        <button
          type="button"
          onClick={() => setResult(null)}
          className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          Try a different competitor
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={run} className="space-y-5 rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Free, before you sign up</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">See what it would tell you about a competitor</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell me what you sell and name one competitor. I&apos;ll read their site and recent news, then tell you what it
          means for you in particular.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="lrCompany">Your company</Label>
        <Input id="lrCompany" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lrSell">What do you sell?</Label>
        <Input
          id="lrSell"
          value={positioning}
          onChange={(e) => setPositioning(e.target.value)}
          placeholder="Scheduling software for dental clinics"
          maxLength={400}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lrIcp">Who buys it?</Label>
        <Input
          id="lrIcp"
          value={icp}
          onChange={(e) => setIcp(e.target.value)}
          placeholder="Practice managers at 2 to 10 chair clinics"
          maxLength={400}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lrDomain">A competitor&apos;s website</Label>
        <Input
          id="lrDomain"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="competitor.com"
          inputMode="url"
          autoCapitalize="none"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={!canRun}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {busy ? "Reading their site and recent news…" : "Read it for me"}
      </Button>
      {busy ? (
        <p className="text-center text-xs text-muted-foreground">
          This usually takes 30 to 60 seconds{seconds > 20 ? `, ${seconds}s so far` : ""}. Some sites are slow to load.
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => {
          trackEvent("live_read_skipped");
          onSkip(companyName.trim());
        }}
        className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
      >
        Skip this and sign up
      </button>
    </form>
  );
}
