import { Eye, Lightbulb, MessageCircleQuestion, Sparkles } from "lucide-react";
import type { IntroRead } from "@/lib/connect-intro";

// The four-part first read on a competitor. Shared by the pre-signup step and
// the finish screen of setup, so both show it the same way.
export function PersonalReadCard({
  competitorName,
  read,
  evidence,
}: {
  competitorName: string;
  read: IntroRead;
  evidence: string[];
}) {
  const parts = [
    { icon: Eye, label: "What I found", text: read.found },
    { icon: Sparkles, label: "What it means for you", text: read.meaning },
    { icon: Lightbulb, label: "What you could do", text: read.move },
    { icon: MessageCircleQuestion, label: "What I'd ask you", text: read.question },
  ];
  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 rounded-xl border border-primary/25 bg-card p-5 duration-300">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">My read on {competitorName}</p>
      <dl className="mt-4 space-y-4">
        {parts.map(({ icon: Icon, label, text }) => (
          <div key={label} className="flex gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="size-4" />
            </span>
            <div>
              <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 text-sm leading-relaxed">{text}</dd>
            </div>
          </div>
        ))}
      </dl>
      <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
        {read.confidence === "thin"
          ? "There wasn't much public to go on, which is itself worth knowing. "
          : ""}
        {evidence.length > 0 ? `Based on: ${evidence.join(", ")}. ` : ""}
        This is a first look with no history, so I can say how things stand, not what changed. Watching over time is what catches that.
      </p>
    </div>
  );
}
