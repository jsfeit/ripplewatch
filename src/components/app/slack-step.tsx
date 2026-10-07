"use client";

import { Check, Hash, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HowItFits } from "@/components/app/how-it-fits";

// The Slack step of setup: what Slack is for versus the assistant, then the
// connect action. "Connect Slack" saves the setup first (the caller does that),
// because it leaves this page for Slack and nothing typed here would survive.
const CARDS = [
  {
    kicker: "Slack",
    title: "The feed",
    icon: Hash,
    tint: "bg-accent text-accent-foreground",
    lines: ["Posts what changed", "Your whole team sees it", "Nobody has to ask"],
  },
  {
    kicker: "Your assistant",
    title: "The analyst",
    icon: Sparkles,
    tint: "bg-primary/10 text-primary",
    lines: ["Explains why it matters", "Suggests what to do", "Pulls in your deals"],
  },
];

export function SlackStep({ onConnect, busy }: { onConnect: () => void; busy: boolean }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {CARDS.map((c) => (
          <div key={c.title} className="rounded-xl border border-border bg-secondary/30 p-4">
            <div className="flex items-center gap-3">
              <div className={`flex size-8 items-center justify-center rounded-lg ${c.tint}`}>
                <c.icon className="size-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{c.kicker}</p>
                <p className="text-sm font-medium">{c.title}</p>
              </div>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {c.lines.map((l) => (
                <li key={l} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {l}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">See it in Slack, then tap Ask Ripplewatch to dig in with your assistant.</p>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Hash className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Slack</p>
            <p className="text-xs text-muted-foreground">Saves your setup, then opens Slack</p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onConnect} disabled={busy}>
          Connect Slack
        </Button>
      </div>

      <details className="group text-sm">
        <summary className="cursor-pointer list-none text-muted-foreground hover:text-foreground">
          How this fits together
        </summary>
        <div className="mt-3">
          <HowItFits />
        </div>
      </details>
    </div>
  );
}
