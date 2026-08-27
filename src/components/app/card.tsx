import type { ReactNode } from "react";
import { Panel } from "@/components/ui/panel";
import { avatarColor, cn } from "@/lib/utils";

// The one card shape shared across Overview, Trends, News, Pricing, and
// Win/loss — head (avatar/icon + title + eyebrow + right-aligned meta
// badge), body (each section's own content), optional foot (a dashed top
// border separating a link/action row, the pattern already used ad hoc in
// several places before this existed as a shared component). Composable
// rather than one prop-heavy component, since body content varies too
// much (a signal, a tier list, a bar chart, a stat row) to squeeze through
// a fixed shape — only the chrome around it converges.

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <Panel className={cn("flex flex-col gap-3 p-4", className)}>{children}</Panel>;
}

export function CardAvatar({ seed, icon, className }: { seed?: string; icon?: ReactNode; className?: string }) {
  if (icon) {
    return (
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground",
          className
        )}
      >
        {icon}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        avatarColor(seed ?? ""),
        className
      )}
    >
      {(seed ?? "?").charAt(0).toUpperCase()}
    </span>
  );
}

export function CardHead({
  avatar,
  title,
  eyebrow,
  meta,
  className,
}: {
  avatar?: ReactNode;
  title: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {avatar}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{title}</div>
          {eyebrow ? <div className="mt-0.5 truncate text-xs text-muted-foreground">{eyebrow}</div> : null}
        </div>
      </div>
      {meta ? <div className="flex shrink-0 items-center gap-2">{meta}</div> : null}
    </div>
  );
}

// The "Changed {timeAgo}" mini-badge — previously duplicated verbatim in
// competitor-overview.tsx and pricing-board.tsx.
export function CardChangedBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
      {children}
    </span>
  );
}

export function CardFoot({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-t border-dashed border-border pt-2.5 text-xs text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}
