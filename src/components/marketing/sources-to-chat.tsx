import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  Boxes,
  Briefcase,
  GitBranch,
  Megaphone,
  MessageCircle,
  Newspaper,
  Star,
  Tag,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

// Hero visual: the ten things that go into a competitor's Momentum score,
// each with its own -100 to +100 reading, feeding one answer in the
// assistant. The ten inputs, the -100 to +100 range and the +/-15 thresholds
// all come from the published methodology
// (/blog/momentum-score-methodology). The competitor and every number below
// are made up for illustration, same as the rest of the home page examples.
// The two opt-in inputs are shown as not connected, which is how they read
// until an account turns them on.
const INPUTS: { icon: typeof Tag; label: string; value: number | null }[] = [
  { icon: Briefcase, label: "Hiring", value: 62 },
  { icon: Tag, label: "Pricing activity", value: 48 },
  { icon: Boxes, label: "Product changes", value: 35 },
  { icon: Newspaper, label: "Press and funding", value: 41 },
  { icon: TrendingUp, label: "Relevance trend", value: 28 },
  { icon: Trophy, label: "Win rate vs. you", value: 55 },
  { icon: Star, label: "Review sentiment", value: 12 },
  { icon: MessageCircle, label: "Buzz (Reddit, HN)", value: 30 },
  { icon: GitBranch, label: "GitHub activity", value: null },
  { icon: Megaphone, label: "Ad activity", value: null },
];

const SCORE = 38;
// Position on the -100..+100 track, as a percentage.
const pct = (n: number) => ((n + 100) / 200) * 100;

export function SourcesToChat() {
  return (
    <div className="mx-auto mt-14 flex max-w-5xl flex-col items-stretch gap-5 md:flex-row md:gap-5">
      <div className="flex-[1.15]">
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Ten inputs, each scored from -100 to +100
        </p>
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" aria-label="What goes into Momentum">
          {INPUTS.map((s) => (
            <li
              key={s.label}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"
            >
              <s.icon className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="leading-tight">{s.label}</span>
              {s.value === null ? (
                <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">opt-in</span>
              ) : (
                <span className="ml-auto shrink-0 text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  +{s.value}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex shrink-0 items-center justify-center md:self-center" aria-hidden>
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ArrowDown className="size-4 md:hidden" />
          <ArrowRight className="hidden size-4 md:block" />
        </span>
      </div>

      <Panel className="flex flex-1 flex-col p-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-border pb-3 text-xs text-muted-foreground">
          <span className="size-2 rounded-full bg-primary" />
          Claude, with Ripplewatch connected
        </div>
        <div className="flex flex-1 flex-col justify-center gap-3 pt-4">
          <div className="ml-auto max-w-[90%] rounded-lg bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground">
            Is Northlane heating up?
          </div>
          <div className="mr-auto rounded-lg border border-primary/20 bg-accent/60 px-3.5 py-3 text-sm leading-relaxed">
            <p>
              <span className="font-semibold">Yes. Momentum is +{SCORE}, Heating up.</span> That compares their last
              30 days with the 30 before, across the eight inputs that have real data. Hiring, how often you lose
              to them, and their pricing moves are pulling it up most. GitHub and ad activity are opt-in and not connected.
            </p>
            <div className="mt-4" aria-label={`Momentum +${SCORE} on a scale from -100 to +100`}>
              <div className="relative h-2 rounded-full bg-secondary">
                <div className="absolute inset-y-0 left-0 rounded-l-full bg-rose-500/25" style={{ width: `${pct(-15)}%` }} />
                <div
                  className="absolute inset-y-0 rounded-r-full bg-emerald-500/25"
                  style={{ left: `${pct(15)}%`, right: 0 }}
                />
                <span
                  className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary"
                  style={{ left: `${pct(SCORE)}%` }}
                />
              </div>
              <div className="relative mt-1.5 h-4 text-[10px] text-muted-foreground">
                <span className="absolute left-0">-100</span>
                <span className="absolute -translate-x-1/2" style={{ left: `${pct(-15)}%` }}>
                  -15
                </span>
                <span className="absolute -translate-x-1/2" style={{ left: `${pct(15)}%` }}>
                  +15
                </span>
                <span className="absolute right-0">+100</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Below -15 is Cooling, above +15 is Heating up, in between is Steady.
              </p>
            </div>
          </div>
        </div>
        <Link
          href="/blog/momentum-score-methodology"
          className={cn("mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline")}
        >
          How Momentum is scored <ArrowRight className="size-3.5" />
        </Link>
      </Panel>
    </div>
  );
}
