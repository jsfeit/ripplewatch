import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

// The other shared piece from the cohesion pass: every section had its own
// way to say "we're not fully confident here" — Momentum's bare
// "(limited data)" text, Pricing's italic "No public pricing found" /
// "couldn't load this pricing page automatically" notes, each a different
// color, weight, and (for Momentum) no icon at all. One small pill instead,
// used wherever a section needs to flag a gap rather than invent its own
// wording for it.
export function CaveatNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-start gap-1 rounded-md bg-secondary px-1.5 py-1 text-[11px] leading-snug text-muted-foreground",
        className
      )}
    >
      <Info className="mt-[1.5px] size-3 shrink-0 opacity-70" />
      {children}
    </span>
  );
}
