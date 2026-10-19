import {
  ArrowDown,
  ArrowRight,
  Briefcase,
  Boxes,
  MessageSquareQuote,
  Newspaper,
  PhoneCall,
  Tag,
  Trophy,
} from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

// Hero visual: every competitive signal on the left, one assistant chat on
// the right. Static on purpose (server component, no JS). The competitor is
// fictional, same as the rest of the home page examples.
const SOURCES = [
  { icon: Tag, label: "Pricing pages" },
  { icon: Briefcase, label: "Job postings" },
  { icon: Newspaper, label: "News and funding" },
  { icon: Boxes, label: "Product changes" },
  { icon: Trophy, label: "Your win/loss" },
  { icon: MessageSquareQuote, label: "Customer feedback" },
  { icon: PhoneCall, label: "Sales-call notes" },
];

export function SourcesToChat() {
  return (
    <div className="mx-auto mt-14 flex max-w-5xl flex-col items-stretch gap-5 md:flex-row md:gap-5">
      <ul
        className="grid flex-1 grid-cols-2 gap-2.5 md:auto-rows-fr"
        aria-label="Signals Ripplewatch pulls together"
      >
        {SOURCES.map((s, i) => (
          <li
            key={s.label}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm",
              i === SOURCES.length - 1 &&
                SOURCES.length % 2 === 1 &&
                "col-span-2",
            )}
          >
            <s.icon className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="leading-tight md:whitespace-nowrap">{s.label}</span>
          </li>
        ))}
      </ul>

      <div
        className="flex shrink-0 items-center justify-center md:self-center"
        aria-hidden
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ArrowDown className="size-4 md:hidden" />
          <ArrowRight className="hidden size-4 md:block" />
        </span>
      </div>

      <Panel className="flex flex-[1.3] flex-col p-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-border pb-3 text-xs text-muted-foreground">
          <span className="size-2 rounded-full bg-primary" />
          Claude, with Ripplewatch connected
        </div>
        <div className="flex flex-1 flex-col justify-center gap-3 pt-4">
          <div className="ml-auto max-w-[90%] rounded-lg bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground">
            Who is heating up this week?
          </div>
          <div className="mr-auto max-w-[92%] rounded-lg border border-primary/20 bg-accent/60 px-3.5 py-2.5 text-sm leading-relaxed">
            Northlane. They cut their entry tier to $69/mo and opened three
            sales roles. Both land on the deals you lost to them last quarter.
          </div>
        </div>
      </Panel>
    </div>
  );
}
