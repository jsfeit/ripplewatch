import { cn } from "@/lib/utils";

// A small set of abstract, line-art cover marks standing in for real
// photography/illustration (neither is available here) — one per rough
// content shape a post can take. Deterministic per-slug via
// BLOG_VISUAL_KIND below, not random, so a given post's identity on the
// index and its own hero always match.
export type BlogVisualKind = "signal" | "compare" | "process" | "data" | "field";

const KIND_LABEL: Record<BlogVisualKind, string> = {
  signal: "Signal",
  compare: "Comparison",
  process: "Playbook",
  data: "Methodology",
  field: "Field notes",
};

// Full class strings, not interpolated fragments — Tailwind's compiler
// only picks up classes it can find as complete literal strings.
const KIND_ACCENT: Record<BlogVisualKind, string> = {
  signal: "text-chart-1",
  compare: "text-chart-2",
  process: "text-chart-3",
  data: "text-chart-4",
  field: "text-chart-5",
};

export function blogVisualLabel(kind: BlogVisualKind): string {
  return KIND_LABEL[kind];
}

// Every published slug gets an explicit kind (curated, not hashed) so the
// mark actually fits what the post is about. New posts default to
// "signal" until added here.
export const BLOG_VISUAL_KIND: Record<string, BlogVisualKind> = {
  "competitor-analysis-101-before-you-buy-a-tool": "process",
  "who-to-track-and-who-to-ignore": "process",
  "the-weekly-competitive-intelligence-review": "process",
  "what-competitive-intelligence-software-actually-automates": "signal",
  "the-battlecard-nobody-updates": "process",
  "competitor-tracking-tools-under-500-a-month": "compare",
  "ripplewatch-vs-seo-competitor-research-tools": "compare",
  "klue-vs-crayon-vs-ripplewatch-enterprise-grade-cost": "compare",
  "what-a-competitive-intelligence-dashboard-should-track": "data",
  "g2-vs-gartner-vs-building-your-own-win-loss-process": "compare",
  "what-slack-native-competitive-intelligence-actually-looks-like": "signal",
  "why-competitive-intelligence-goes-stale": "signal",
  "competitive-intelligence-in-an-ai-world": "signal",
  "win-loss-reason-consolidation": "data",
  "why-some-pricing-pages-cant-be-scraped": "field",
  "momentum-score-methodology": "data",
  "why-competitive-intelligence-should-always-be-on": "signal",
  "battlecard-sales-team-will-actually-use": "process",
  "competitive-intelligence-for-solo-founders": "process",
  "how-to-run-a-win-loss-interview": "process",
};

export function visualKindForSlug(slug: string): BlogVisualKind {
  return BLOG_VISUAL_KIND[slug] ?? "signal";
}

type MarkProps = { accentClass: string };

// Concentric ripples from a center point — a direct, quiet nod to the
// product name, used as the default/general-CI mark.
function SignalMark({ accentClass }: MarkProps) {
  return (
    <svg viewBox="0 0 400 240" className="size-full" aria-hidden="true">
      <g className={accentClass} fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="150" cy="120" r="28" opacity="0.9" />
        <circle cx="150" cy="120" r="58" opacity="0.6" />
        <circle cx="150" cy="120" r="90" opacity="0.35" />
        <circle cx="150" cy="120" r="124" opacity="0.18" />
      </g>
      <circle cx="150" cy="120" r="5" className={accentClass} fill="currentColor" />
    </svg>
  );
}

// Two offset panels meeting at a shared edge — one thing measured against
// another, for vs./alternatives-style posts.
function CompareMark({ accentClass }: MarkProps) {
  return (
    <svg viewBox="0 0 400 240" className="size-full" aria-hidden="true">
      <rect x="76" y="56" width="140" height="128" rx="10" className="text-border" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="184" y="56" width="140" height="128" rx="10" className={accentClass} fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="200" y1="70" x2="200" y2="170" className={accentClass} stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 5" opacity="0.6" />
      <circle cx="200" cy="120" r="15" className={accentClass} fill="currentColor" opacity="0.12" />
      <path d="M193 113 L207 127 M207 113 L193 127" className={accentClass} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// A short row of connected, checked-off steps — a runnable process, not
// just an idea.
function ProcessMark({ accentClass }: MarkProps) {
  const steps = [70, 160, 250, 340];
  return (
    <svg viewBox="0 0 400 240" className="size-full" aria-hidden="true">
      <line x1="70" y1="120" x2="340" y2="120" className="text-border" stroke="currentColor" strokeWidth="1.5" />
      {steps.map((x, i) => (
        <g key={x}>
          <rect x={x - 20} y={100} width="40" height="40" rx="8" className={i < 3 ? accentClass : "text-border"} fill="none" stroke="currentColor" strokeWidth="1.5" />
          {i < 3 ? (
            <path d={`M${x - 9} 120 l7 8 l13 -16`} className={accentClass} stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <circle cx={x} cy={120} r="3" className="text-border" fill="currentColor" />
          )}
        </g>
      ))}
    </svg>
  );
}

// A rising bar series with a trend line over it — the methodology/scoring
// mark.
function DataMark({ accentClass }: MarkProps) {
  const bars = [
    { x: 90, h: 40 },
    { x: 140, h: 70 },
    { x: 190, h: 55 },
    { x: 240, h: 95 },
    { x: 290, h: 120 },
  ];
  return (
    <svg viewBox="0 0 400 240" className="size-full" aria-hidden="true">
      <line x1="70" y1="180" x2="330" y2="180" className="text-border" stroke="currentColor" strokeWidth="1.5" />
      {bars.map((b) => (
        <rect key={b.x} x={b.x - 14} y={180 - b.h} width="28" height={b.h} rx="4" className={accentClass} fill="currentColor" opacity="0.18" />
      ))}
      <polyline
        points={bars.map((b) => `${b.x},${180 - b.h - 8}`).join(" ")}
        className={accentClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {bars.map((b) => (
        <circle key={`dot-${b.x}`} cx={b.x} cy={180 - b.h - 8} r="3.5" className={accentClass} fill="currentColor" />
      ))}
    </svg>
  );
}

// A sweeping scan arc with a couple of caught signals — technical
// diagnosis / "field notes" posts (scraping, infra).
function FieldMark({ accentClass }: MarkProps) {
  return (
    <svg viewBox="0 0 400 240" className="size-full" aria-hidden="true">
      <g className="text-border" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="150" cy="120" r="95" />
      </g>
      <path
        d="M150 120 L150 25 A95 95 0 0 1 222 62 Z"
        className={accentClass}
        fill="currentColor"
        opacity="0.14"
      />
      <line x1="150" y1="120" x2="222" y2="62" className={accentClass} stroke="currentColor" strokeWidth="1.5" />
      <circle cx="150" cy="120" r="4" className={accentClass} fill="currentColor" />
      <circle cx="105" cy="70" r="3.5" className="text-border" fill="currentColor" />
      <circle cx="195" cy="165" r="3.5" className="text-border" fill="currentColor" />
      <circle cx="90" cy="150" r="3.5" className="text-border" fill="currentColor" />
    </svg>
  );
}

const MARKS: Record<BlogVisualKind, (props: MarkProps) => React.ReactElement> = {
  signal: SignalMark,
  compare: CompareMark,
  process: ProcessMark,
  data: DataMark,
  field: FieldMark,
};

export function BlogVisual({ kind, className }: { kind: BlogVisualKind; className?: string }) {
  const Mark = MARKS[kind];
  const accentClass = KIND_ACCENT[kind];
  return (
    <div className={cn("relative overflow-hidden bg-secondary", className)}>
      <Mark accentClass={accentClass} />
    </div>
  );
}
