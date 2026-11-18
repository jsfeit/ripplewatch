import { Check, Lock, Radar } from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanyLogo } from "@/components/app/company-logo";
import { MOMENTUM_STYLES } from "@/lib/momentum";

// A sneak peek at Momentum during setup. Nothing here is a made-up score. Every
// competitor is brand new at this point, so rather than flag "not enough history"
// (which would be true of everyone), each row shows what the first check found and says
// when the trend arrives. The four real labels are shown as the legend so people
// know what they're about to get. The six drivers are the ones
// computeMomentum actually uses (see src/lib/momentum.ts).
const LABELS: { name: string; dot: string; meaning: string }[] = [
  { name: "Heating up", dot: "bg-orange-500", meaning: "More moves than usual" },
  { name: "Steady", dot: "bg-emerald-500", meaning: "Business as usual" },
  { name: "Cooling", dot: "bg-sky-500", meaning: "Slowing down" },
  { name: "Gone quiet", dot: "bg-muted-foreground", meaning: "Nothing new lately" },
];

// A real read for one competitor, once Ripplewatch has one.
export type LiveMomentum = { label: string; score: number | null; confidence: string; activity?: { label: string; detail: string } };

export function MomentumTease({
  names,
  domainByName,
  live,
  className,
}: {
  names: string[];
  // Optional, so a row can show the company's logo when its domain is known.
  domainByName?: Record<string, string>;
  // Real reads keyed by lowercase competitor name. A competitor with none yet still says it is being
  // calculated, so nothing on this card is ever a made-up score.
  live?: Record<string, LiveMomentum>;
  className?: string;
}) {
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
        {shown.map((name) => {
          const read = live?.[name.trim().toLowerCase()];
          const hasRead = Boolean(read && read.score !== null && read.label in MOMENTUM_STYLES && read.label !== "Not enough history yet");
          return (
            <li key={name} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <CompanyLogo name={name} domain={domainByName?.[name.trim()]} />
                <span className="truncate font-medium">{name.trim()}</span>
              </span>
              {hasRead && read ? (
                <span className="flex shrink-0 items-center gap-2 text-xs">
                  <span className={cn("rounded-full px-2 py-0.5 font-semibold", MOMENTUM_STYLES[read.label as keyof typeof MOMENTUM_STYLES])}>
                    {read.label}
                    {read.score !== null ? ` ${read.score > 0 ? "+" : ""}${read.score}` : ""}
                  </span>
                  {read.confidence === "low" ? <span className="text-muted-foreground">early read</span> : null}
                </span>
              ) : (
                <span className="flex shrink-0 flex-col items-end text-right text-xs text-muted-foreground">
                  {read?.activity ? (
                    <>
                      <span className="font-medium text-foreground">{read.activity.label}</span>
                      {read.activity.detail !== read.activity.label ? <span>{read.activity.detail}</span> : null}
                    </>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/50 motion-reduce:hidden" />
                        <span className="relative inline-flex size-2 rounded-full bg-primary" />
                      </span>
                      First check running
                    </span>
                  )}
                  <span>Momentum trend: about a month</span>
                </span>
              )}
            </li>
          );
        })}
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
        Momentum is a trend: it compares the last 30 days with the 30 before, so the first score takes about a month.
        Until then you see what the first check found. It gets sharper every time you log a deal.
      </p>
    </div>
  );
}

// What the analyst can do so far, lit up as each thing is told to it. Every tile
// maps to a real capability and turns on from what has been entered, nothing else.
export type Skill = { label: string; on: boolean; hint: string };

// How briefed the analyst is, from what's been told so far. Purely a progress
// cue: it reflects what you entered, nothing hidden.
export function ReadinessMeter({ percent, skills }: { percent: number; skills?: Skill[] }) {
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
      {skills ? (
        <ul className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4" aria-label="What your analyst can do so far">
          {skills.map((sk) => (
            <li
              key={sk.label}
              title={sk.hint}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors duration-500",
                sk.on ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"
              )}
            >
              {sk.on ? <Check className="size-3" /> : <Lock className="size-3" />}
              <span className="truncate">{sk.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
