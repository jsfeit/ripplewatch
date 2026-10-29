"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleHelp, Info, Loader2, Lock, Mail, Minus, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackEvent } from "@/lib/analytics";
import { readStoredUtm } from "@/components/utm-capture";

type Step = "homepage" | "pricing" | "jobs" | "news" | "history" | "backup";
type Trend = "heating_up" | "cooling_off" | "steady" | "unclear";

type Card = {
  domain: string;
  name: string;
  evidence: string[];
  pricing: { state: string; from: string | null };
  openRoles: number | null;
  newsCount: number;
  history: { capturedAt: string; changed: boolean; summary: string } | null;
};

type Read = {
  competitors: { domain: string; trend: Trend; headline: string; changed: string; matters: string }[];
  watchFirst: { domain: string; reason: string };
  move: string;
  question: string;
};

const STEPS: { key: Step; label: string }[] = [
  { key: "homepage", label: "Reading their site" },
  { key: "pricing", label: "Pricing page" },
  { key: "jobs", label: "Job board" },
  { key: "news", label: "Recent news" },
  { key: "history", label: "Pricing a year ago" },
  { key: "backup", label: "How they talk about themselves" },
];

const TREND: Record<Trend, { label: string; icon: typeof TrendingUp; tone: string }> = {
  heating_up: { label: "Heating up", icon: TrendingUp, tone: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  cooling_off: { label: "Cooling off", icon: TrendingDown, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  steady: { label: "Holding steady", icon: Minus, tone: "bg-secondary text-muted-foreground" },
  unclear: { label: "Not enough to tell", icon: CircleHelp, tone: "bg-secondary text-muted-foreground" },
};

// The pricing-and-jobs fetch finishes as one stage, so both ticks arrive together.
function stepDone(done: Set<Step>, key: Step) {
  return done.has(key);
}

// A teaser for the one number a single look can't produce. Explains what it is on hover, focus or
// tap, and says plainly that it needs 30 days of watching and comes with the paid product.
function MomentumTease() {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-2 text-xs">
      <span className="font-semibold text-muted-foreground">Momentum</span>
      <span className="relative h-1.5 w-24 overflow-hidden rounded-full bg-border" aria-hidden="true">
        <span className="absolute inset-y-0 left-0 w-1/3 animate-pulse rounded-full bg-primary/40" />
      </span>
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Lock className="size-3" />
        Calculating once you start watching
      </span>
      <span className="relative">
        <button
          type="button"
          aria-label="What is Momentum?"
          aria-describedby={open ? tipId : undefined}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Info className="size-3.5" />
        </button>
        {open ? (
          <span
            id={tipId}
            role="tooltip"
            className="absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-lg border border-border bg-popover p-3 text-left text-xs leading-relaxed text-popover-foreground shadow-lg"
          >
            <span className="block font-semibold">Momentum, -100 to +100</span>
            One number per competitor for whether they are heating up or cooling off. It blends hiring, pricing and
            product changes, press and funding, and how your own wins and losses against them are trending, over a
            30-day window. A one-time look has no history, so it can&apos;t be scored yet. It&apos;s part of the paid product.
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function FreeReadTool() {
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [positioning, setPositioning] = useState("");
  const [icp, setIcp] = useState("");
  const [domains, setDomains] = useState(["", ""]);
  const [phase, setPhase] = useState<"form" | "building" | "done">("form");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<Record<string, Set<Step>>>({});
  const [cards, setCards] = useState<Record<string, Card>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [writing, setWriting] = useState(false);
  const [read, setRead] = useState<Read | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const buildRef = useRef<HTMLDivElement>(null);

  const filled = domains.map((d) => d.trim()).filter(Boolean);
  const canRun = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && positioning.trim().length >= 3 && filled.length > 0 && phase === "form";

  function setDomain(i: number, v: string) {
    setDomains((prev) => prev.map((d, idx) => (idx === i ? v : d)));
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!canRun) return;
    setError("");
    setPhase("building");
    setProgress({});
    setCards({});
    setRead(null);
    setWriting(false);
    trackEvent("free_read_requested", { competitors: filled.length });
    // The form is tall, so bring the live checklist into view rather than leave it below the fold.
    setTimeout(() => buildRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    const utm = readStoredUtm();
    try {
      const res = await fetch("/api/free-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          companyName,
          positioning,
          icp,
          domains: filled,
          utm_source: utm?.source ?? "",
          utm_medium: utm?.medium ?? "",
          utm_campaign: utm?.campaign ?? "",
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't run that just now. Try again in a minute.");
        setPhase("form");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.t === "start") {
            setOrder(ev.domains);
          } else if (ev.t === "step") {
            setProgress((p) => {
              const next = new Set(p[ev.domain] ?? []);
              next.add(ev.step as Step);
              return { ...p, [ev.domain]: next };
            });
          } else if (ev.t === "competitor") {
            setCards((c) => ({ ...c, [ev.card.domain]: ev.card }));
          } else if (ev.t === "writing") {
            setWriting(true);
          } else if (ev.t === "read") {
            setRead(ev.read);
            setPhase("done");
            finished = true;
            trackEvent("free_read_shown");
            setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
          } else if (ev.t === "error") {
            setError(ev.message);
            setPhase("form");
            finished = true;
          }
        }
      }
      if (!finished) {
        setError("That took too long. Try again, or try fewer competitors.");
        setPhase("form");
      }
    } catch {
      setError("Couldn't run that just now. Try again in a minute.");
      setPhase("form");
    }
  }

  const nameFor = (domain: string) => cards[domain]?.name ?? domain;

  if (phase !== "form") {
    return (
      <div className="space-y-6">
        <div ref={buildRef} className="scroll-mt-24 space-y-4">
          {order.map((domain) => {
            const done = progress[domain] ?? new Set<Step>();
            const finished = Boolean(cards[domain]);
            const current = STEPS.find((s) => !stepDone(done, s.key))?.key;
            return (
              <div key={domain} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{finished ? nameFor(domain) : domain}</p>
                  {finished ? (
                    <span className="flex items-center gap-1 text-xs text-primary">
                      <Check className="size-3.5" /> Read
                    </span>
                  ) : (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                <ul className="mt-3 grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
                  {STEPS.map((s) => {
                    const isDone = finished || stepDone(done, s.key);
                    const isCurrent = !finished && current === s.key;
                    return (
                      <li key={s.key} className={isDone ? "text-foreground" : "text-muted-foreground"}>
                        <span className="inline-flex items-center gap-1.5">
                          {isDone ? (
                            <Check className="size-3.5 text-primary" />
                          ) : isCurrent ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <span className="size-3.5 rounded-full border border-border" />
                          )}
                          {s.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {finished ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {cards[domain].pricing.from ? `Starts at ${cards[domain].pricing.from}. ` : ""}
                    {cards[domain].openRoles !== null ? `${cards[domain].openRoles} open roles. ` : ""}
                    {cards[domain].newsCount > 0 ? `${cards[domain].newsCount} recent news items. ` : ""}
                    {cards[domain].history
                      ? cards[domain].history.changed
                        ? "Pricing has changed since last year."
                        : "Pricing hasn't changed much in a year."
                      : ""}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        {phase === "building" ? (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {writing ? "Writing your read against what you sell…" : "Reading all of them at once. About a minute."}
          </p>
        ) : null}

        {read ? (
          <div ref={resultRef} className="animate-in fade-in slide-in-from-bottom-1 space-y-5 duration-300">
            <div className="space-y-4">
              {[...read.competitors]
                .sort((a, b) => {
                  const rank: Record<Trend, number> = { heating_up: 0, cooling_off: 1, steady: 2, unclear: 3 };
                  return rank[a.trend] - rank[b.trend];
                })
                .map((c) => {
                  const t = TREND[c.trend];
                  const Icon = t.icon;
                  const watch = read.watchFirst.domain === c.domain;
                  return (
                    <div key={c.domain} className={`rounded-xl border bg-card p-5 ${watch ? "border-primary/50" : "border-border"}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{nameFor(c.domain)}</p>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${t.tone}`}>
                          <Icon className="size-3.5" />
                          {t.label}
                        </span>
                      </div>
                      <p className="mt-2 text-sm">{c.headline}</p>
                      <MomentumTease />
                      <dl className="mt-3 space-y-2 text-sm">
                        <div>
                          <dt className="text-xs font-semibold text-muted-foreground">What changed</dt>
                          <dd className="text-muted-foreground">{c.changed}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold text-muted-foreground">What it means for you</dt>
                          <dd className="text-muted-foreground">{c.matters}</dd>
                        </div>
                      </dl>
                      {watch ? (
                        <p className="mt-3 border-t border-border pt-3 text-xs text-primary">
                          Watch this one first: {read.watchFirst.reason}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
            </div>

            <div className="rounded-xl border border-primary/25 bg-card p-5 text-sm">
              <p>
                <span className="font-semibold">What you could do: </span>
                {read.move}
              </p>
              <p className="mt-2 text-muted-foreground">
                <span className="font-semibold text-foreground">Worth answering from your own deals: </span>
                {read.question}
              </p>
            </div>

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="size-3.5" />
              A copy is on its way to {email.trim()}.
            </p>
            <p className="text-xs text-muted-foreground">
              Built from each company&apos;s public pages and recent news. Check anything you plan to act on.
            </p>

            <div className="rounded-2xl border border-border bg-secondary/30 p-6 text-center">
              <h2 className="text-lg font-semibold tracking-tight">That was one look. Now keep watching.</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                I can say how each one stands today. Watching over time is what catches the move before it shows up in a deal, and
                starts the Momentum score for each competitor. $29 a month plus usage, and you ask it in Claude or ChatGPT.
              </p>
              <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/onboarding?path=connect" className={buttonVariants({ size: "lg" })} onClick={() => trackEvent("free_read_cta_clicked")}>
                  Keep watching these
                  <ArrowRight className="size-4" />
                </Link>
                <Link href="/pricing" className={buttonVariants({ size: "lg", variant: "outline" })}>
                  See pricing
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={run} className="space-y-5 rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="space-y-2">
        <Label htmlFor="frSell">What do you sell?</Label>
        <Input
          id="frSell"
          value={positioning}
          onChange={(e) => setPositioning(e.target.value)}
          placeholder="Support software for B2B SaaS"
          maxLength={400}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="frIcp">
          Who buys it <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="frIcp"
          value={icp}
          onChange={(e) => setIcp(e.target.value)}
          placeholder="Heads of support at SaaS companies"
          maxLength={400}
        />
      </div>
      <div className="space-y-2">
        <Label>Your competitors&apos; websites</Label>
        {domains.map((d, i) => (
          <Input
            key={i}
            value={d}
            onChange={(e) => setDomain(i, e.target.value)}
            placeholder={i === 0 ? "biggest-competitor.com" : "another-one.com (optional)"}
            inputMode="url"
            autoCapitalize="none"
            aria-label={`Competitor ${i + 1}`}
          />
        ))}
        {domains.length < 3 ? (
          <button
            type="button"
            onClick={() => setDomains((p) => [...p, ""])}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Plus className="size-3.5" /> Add a third
          </button>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="frEmail">Where should I send it?</Label>
          <Input
            id="frEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="frCompany">
            Your company <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input id="frCompany" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme" autoComplete="organization" />
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" size="lg" disabled={!canRun}>
        Build my read
        <ArrowRight className="size-4" />
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Free, no card. You&apos;ll watch it built live, and a copy goes to your email. We don&apos;t share it.
      </p>
    </form>
  );
}
