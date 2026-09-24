import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOMENTUM_STYLES } from "@/lib/momentum";
import { MomentumMeter } from "./competitor-overview";
import type { YourMomentumResult } from "@/lib/your-momentum";

// The account's own side of Momentum, sitting next to competitor Momentum
// so "how are they doing" and "how are we doing" read as one consistent
// vocabulary instead of two disconnected systems — same label set, same
// gradient meter, same "limited data" caveat language.
export function YourMomentumCard({ result }: { result: YourMomentumResult }) {
  const hasScore = result.score !== null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <TrendingUp className="size-3.5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Your Momentum</h3>
            <p className="text-xs text-muted-foreground">Built from your own NPS and win-rate trend, not a competitor&apos;s.</p>
          </div>
        </div>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
            MOMENTUM_STYLES[result.label]
          )}
        >
          {hasScore ? (
            <span className="font-bold tabular-nums">
              {result.score! > 0 ? "+" : ""}
              {result.score}
            </span>
          ) : null}
          {result.label}
          {hasScore && result.confidence === "low" ? <span className="text-[10px] opacity-70">(limited data)</span> : null}
        </span>
      </div>

      {hasScore ? (
        <>
          <MomentumMeter score={result.score} size="lg" className="mt-3" />
          <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
            {Object.values(result.components).map((c) => (
              <div key={c.label} className="flex items-center justify-between gap-2">
                <span>{c.label}</span>
                <span className="shrink-0 tabular-nums">{c.detail}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Log NPS scores in Customer voice and win/loss data below to see your own momentum trend here.
        </p>
      )}
    </div>
  );
}
