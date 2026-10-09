import { Radar } from "lucide-react";
import { cn } from "@/lib/utils";

// A sneak peek at Momentum during setup. Nothing here is a made-up score: a
// brand-new competitor honestly reads "Not enough history yet" (the same label
// the product shows), and the four real labels are shown as the legend so
// people know what they're about to get. The six drivers are the ones
// computeMomentum actually uses (see src/lib/momentum.ts).
const LABELS: { name: string; dot: string; meaning: string }[] = [
  { name: "Heating up", dot: "bg-orange-500", meaning: "More moves than usual" },
  { name: "Steady", dot: "bg-emerald-500", meaning: "Business as usual" },
  { name: "Cooling", dot: "bg-sky-500", meaning: "Slowing down" },
  { name: "Gone quiet", dot: "bg-muted-foreground", meaning: "Nothing new lately" },
];

export function MomentumTease({ names, className }: { names: string[]; className?: string }) {
  const shown = names.filter((n) => n.trim()).slice(0, 5);
  if (shown.length === 0) return null;
  return (
    <div className={cn("rounded-lg border border-primary/25 bg-primary/[0.04] p-4", className)}>
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Radar className="size-4" />
        Your Momentum board
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Every competitor gets a Momentum read: are they heating up or cooling off? It&apos;s built from their hiring,
        pricing, product changes and press, plus how relevant their moves are to you and your win rate against them.
      </p>
      <ul className="mt-3 space-y-1.5">
        {shown.map((name) => (
          <li key={name} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm">
            <span className="truncate font-medium">{name.trim()}</span>
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/50 motion-reduce:hidden" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              Reading… not enough history yet
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {LABELS.map((l) => (
          <span key={l.name} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", l.dot)} />
            <span className="font-medium text-foreground">{l.name}</span>
            {l.meaning}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        First findings usually land within minutes. Momentum firms up as history builds, and gets sharper every time you
        log a deal.
      </p>
    </div>
  );
}

// How briefed the analyst is, from what's been told so far. Purely a progress
// cue: it reflects what you entered, nothing hidden.
export function ReadinessMeter({ percent }: { percent: number }) {
  const label = percent < 35 ? "Just got the keys" : percent < 70 ? "Learning your market" : percent < 100 ? "Nearly ready" : "Fully briefed";
  return (
    <div className="mb-3" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="How briefed your analyst is">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">Your analyst is {percent}% briefed</span>
        <span className="text-muted-foreground">{label}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
