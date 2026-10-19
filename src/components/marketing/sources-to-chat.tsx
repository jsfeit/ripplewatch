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
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  Trophy,
  Upload,
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
  { icon: Star, label: "Review sentiment", value: -22 },
  { icon: MessageCircle, label: "Buzz (Reddit, HN)", value: -14 },
  { icon: GitBranch, label: "GitHub activity", value: null },
  { icon: Megaphone, label: "Ad activity", value: null },
];

const SCORE = 31;
// Position on the -100..+100 track, as a percentage.
const pct = (n: number) => ((n + 100) / 200) * 100;

export function SourcesToChat() {
  return (
    <div className="mx-auto mt-14 flex max-w-5xl flex-col gap-5">
      <div className="flex flex-col items-stretch gap-5 md:flex-row md:gap-5">
        <div className="flex-[1.15]">
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ten inputs, each scored from -100 to +100
          </p>
          <ul
            className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
            aria-label="What goes into Momentum"
          >
            {INPUTS.map((s) => (
              <li
                key={s.label}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"
              >
                <s.icon className="size-4 shrink-0 text-primary" aria-hidden />
                <span className="leading-tight">{s.label}</span>
                {s.value === null ? (
                  <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                    opt-in
                  </span>
                ) : (
                  <span
                    className={cn(
                      "ml-auto shrink-0 text-xs font-semibold tabular-nums",
                      s.value < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {s.value > 0 ? `+${s.value}` : s.value}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div
          className="flex shrink-0 items-center justify-center md:self-center"
          aria-hidden
        >
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
                <span className="font-semibold">
                  Yes. Momentum is +{SCORE}, Heating up.
                </span>{" "}
                That compares their last 30 days with the 30 before, across the
                eight inputs that have real data. Hiring, how often you lose to
                them, and their pricing moves are pulling it up most. Reviews
                and Reddit buzz are pulling it down. GitHub and ad activity are
                opt-in and not connected.
              </p>
              <div
                className="mt-4"
                aria-label={`Momentum +${SCORE} on a scale from -100 to +100`}
              >
                <div className="relative h-2 rounded-full bg-secondary">
                  <div
                    className="absolute inset-y-0 left-0 rounded-l-full bg-rose-500/25"
                    style={{ width: `${pct(-15)}%` }}
                  />
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
                  <span
                    className="absolute -translate-x-1/2"
                    style={{ left: `${pct(-15)}%` }}
                  >
                    -15
                  </span>
                  <span
                    className="absolute -translate-x-1/2"
                    style={{ left: `${pct(15)}%` }}
                  >
                    +15
                  </span>
                  <span className="absolute right-0">+100</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Below -15 is Cooling, above +15 is Heating up, in between is
                  Steady.
                </p>
              </div>
            </div>
          </div>
          <Link
            href="/blog/momentum-score-methodology"
            className={cn(
              "mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline",
            )}
          >
            How Momentum is scored <ArrowRight className="size-3.5" />
          </Link>
        </Panel>
      </div>
      <TeachIt />
    </div>
  );
}

// How the assistant gets sharper. Each step maps to real MCP tools
// (set_context, add_competitor, log_win_loss / import_win_loss,
// log_customer_feedback, log_call_mentions, ask, get_next_step), so nothing
// here is a promise about features that don't exist.
const TEACH_STEPS: {
  icon: typeof Tag;
  title: string;
  body: string;
  example: string;
}[] = [
  {
    icon: SlidersHorizontal,
    title: "Tell it who you are",
    body: "Your positioning, your buyer, the competitors you care about. Change any of it by just saying so.",
    example: "“We sell to RevOps teams. Add Northlane and Brightwell.”",
  },
  {
    icon: Upload,
    title: "Feed it what you know",
    body: "Won and lost deals, customer feedback, competitor mentions from calls. Paste a CSV or say it in chat.",
    example: "“We lost Acme to Northlane on price.”",
  },
  {
    icon: Sparkles,
    title: "Keep asking",
    body: "Every signal is scored against your own deal history, so answers get more specific to you the more it has.",
    example: "“What should we share next to sharpen this?”",
  },
];

function TeachIt() {
  return (
    <div className="w-full basis-full rounded-xl border border-border bg-card/50 p-5 md:mt-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Yours to shape, and it gets sharper as you use it
      </p>
      <ol className="mt-3 grid gap-3 md:grid-cols-3">
        {TEACH_STEPS.map((t) => (
          <li
            key={t.title}
            className="rounded-lg border border-border bg-card p-3.5 text-sm"
          >
            <div className="flex items-center gap-2 font-medium">
              <t.icon className="size-4 text-primary" aria-hidden />
              {t.title}
            </div>
            <p className="mt-1.5 leading-relaxed text-muted-foreground">
              {t.body}
            </p>
            <p className="mt-2 rounded-md bg-primary/10 px-2.5 py-1.5 text-[13px] leading-snug">
              {t.example}
            </p>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span>Day one: general reads</span>
        <div className="h-1.5 flex-1 rounded-full bg-gradient-to-r from-secondary via-primary/50 to-primary" />
        <span>Month three: scored against your deals</span>
      </div>
    </div>
  );
}
