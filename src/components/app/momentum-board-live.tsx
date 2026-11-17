"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { MomentumTease, type LiveMomentum } from "@/components/app/momentum-tease";

type BoardStatus = {
  churn: { months: number };
  deals: { total: number };
  momentum?: { name: string; label: string; score: number | null; confidence: string }[];
  timing?: string | null;
};

const POLL_MS = 10_000;
// The first check usually lands within minutes. Past this it stops asking, and the Momentum tab has it.
const GIVE_UP_MS = 4 * 60 * 1000;

// The finish-screen payoff: the Momentum board with real reads as soon as they exist, and a plain line
// saying the deals or churn the customer just gave are part of it. Until there is a read for a
// competitor it says it is being calculated, so nothing here is ever a made-up score.
export function MomentumBoardLive({ names, domainByName }: { names: string[]; domainByName?: Record<string, string> }) {
  const [status, setStatus] = useState<BoardStatus | null>(null);

  useEffect(() => {
    let stopped = false;
    const started = Date.now();
    async function check() {
      if (stopped || document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/connect/data-status?momentum=1");
        if (!res.ok) return;
        const data = (await res.json()) as BoardStatus;
        if (stopped) return;
        setStatus(data);
        // Everyone shown has a read: nothing left to wait for.
        const reads = (data.momentum ?? []).filter((m) => m.score !== null && m.label !== "Not enough history yet");
        const shown = names.filter((n) => n.trim()).slice(0, 5);
        if (shown.length > 0 && shown.every((n) => reads.some((m) => m.name.trim().toLowerCase() === n.trim().toLowerCase()))) {
          clearInterval(timer);
        }
      } catch {
        // Offline for a moment: the next check will catch up.
      }
    }
    const timer = setInterval(() => {
      if (Date.now() - started > GIVE_UP_MS) {
        clearInterval(timer);
        return;
      }
      void check();
    }, POLL_MS);
    void check();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
    // The names are stable for the life of the finish screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const live: Record<string, LiveMomentum> = {};
  for (const m of status?.momentum ?? []) live[m.name.trim().toLowerCase()] = { label: m.label, score: m.score, confidence: m.confidence };

  // What each kind of data does, said accurately: deals feed each competitor's win rate against you,
  // which is part of its Momentum read. Churn isn't a Momentum input: it is lined up against competitor
  // moves, and flagged when it rises near one.
  const sentences = status
    ? [
        status.deals.total > 0 ? "Your deals are in, so each competitor's win rate against you is now part of its read." : null,
        status.churn.months > 0 ? "Your churn is in, so I'll flag it when it rises near a competitor's move." : null,
      ].filter((s): s is string => Boolean(s))
    : [];

  return (
    <div className="space-y-3">
      <MomentumTease names={names} domainByName={domainByName} live={live} />
      {sentences.length > 0 ? (
        <p className="flex items-start gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          <Check className="mt-0.5 size-4 shrink-0" />
          <span>{sentences.join(" ")}</span>
        </p>
      ) : null}
      {status?.timing ? <p className="rounded-md border border-border bg-card px-3 py-2 text-sm">{status.timing}</p> : null}
    </div>
  );
}
