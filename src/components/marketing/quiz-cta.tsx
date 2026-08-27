import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

// Two sizes of the same pitch: "section" is a standalone box for pages with
// room to spare (homepage, end of a blog post); "inline" is a single line
// for pages that already have their own primary CTA and just need a lighter
// secondary nudge (compare/alternatives pages).
export function QuizCta({ variant = "section" }: { variant?: "section" | "inline" }) {
  if (variant === "inline") {
    return (
      <p className="text-sm text-muted-foreground">
        Not sure yet?{" "}
        <Link href="/competitive-intelligence-quiz" className="text-primary hover:underline">
          Take the 2-minute quiz
        </Link>{" "}
        to see how your competitive intel stacks up.
      </p>
    );
  }

  return (
    <Panel radius="xl" className="mx-auto max-w-2xl border-primary/20 bg-accent/30 p-6 text-center sm:p-8">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
        <Sparkles className="size-3.5" />
        2-minute quiz
      </span>
      <h3 className="mt-4 text-xl font-semibold tracking-tight">Not sure where you stand?</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        Answer 5 quick questions to find out whether your competitive intelligence is Reactive, Aware,
        Systematic, or Predictive, and what to do about it.
      </p>
      <div className="mt-5">
        <Link href="/competitive-intelligence-quiz" className={cn(buttonVariants())}>
          Take the quiz
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </Panel>
  );
}
