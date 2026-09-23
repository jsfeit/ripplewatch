import type { ReactNode } from "react";

// The one shared shape for "here's the single thing worth knowing from this
// section" — Momentum's focus-competitor banner, Win/loss's headline stat,
// and Trends' recurring theme all used to be three different
// implementations of the same idea (a plain callout box, a stat wedged into
// a heading, and — once Trends auto-generates — another callout). Same
// box, same eyebrow treatment, same icon slot everywhere it's used, so the
// dashboard reads as one system pointing out "look here" rather than each
// section inventing its own way to say it.
export function InsightCallout({
  eyebrow,
  icon,
  children,
  className,
}: {
  eyebrow: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-primary/25 bg-primary/[0.04] p-3 ${className ?? ""}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
        {icon ?? <span className="size-1.5 rounded-full bg-primary" />}
        {eyebrow}
      </div>
      <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}
