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

export function blogVisualLabel(kind: BlogVisualKind): string {
  return KIND_LABEL[kind];
}

// Every published slug gets an explicit kind (curated, not hashed) so the
// mark actually fits what the post is about. Kept deliberately spread out
// across kinds (max two of the same kind back-to-back in publish order) so
// the index grid doesn't read as the same cover repeated — five nearly
// identical "process" cards in a row was the original bug here. New posts
// default to "signal" until added below.
export const BLOG_VISUAL_KIND: Record<string, BlogVisualKind> = {
  "how-to-run-a-win-loss-interview": "process",
  "competitive-intelligence-for-solo-founders": "signal",
  "battlecard-sales-team-will-actually-use": "process",
  "competitor-analysis-101-before-you-buy-a-tool": "data",
  "who-to-track-and-who-to-ignore": "compare",
  "the-weekly-competitive-intelligence-review": "process",
  "what-competitive-intelligence-software-actually-automates": "signal",
  "the-battlecard-nobody-updates": "field",
  "competitor-tracking-tools-under-500-a-month": "compare",
  "ripplewatch-vs-seo-competitor-research-tools": "compare",
  "klue-vs-crayon-vs-ripplewatch-enterprise-grade-cost": "data",
  "what-a-competitive-intelligence-dashboard-should-track": "compare",
  "g2-vs-gartner-vs-building-your-own-win-loss-process": "process",
  "what-slack-native-competitive-intelligence-actually-looks-like": "signal",
  "why-competitive-intelligence-goes-stale": "field",
  "competitive-intelligence-in-an-ai-world": "signal",
  "win-loss-reason-consolidation": "data",
  "why-some-pricing-pages-cant-be-scraped": "field",
  "momentum-score-methodology": "data",
  "why-competitive-intelligence-should-always-be-on": "signal",
};

export function visualKindForSlug(slug: string): BlogVisualKind {
  return BLOG_VISUAL_KIND[slug] ?? "signal";
}

// Small deterministic string hash (djb2) — used to seed per-slug color and
// geometry variation so two posts sharing a kind still don't render as the
// exact same mark.
function seedFromSlug(slug: string): number {
  let hash = 5381;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 33) ^ slug.charCodeAt(i);
  }
  return Math.abs(hash);
}

// A wider color rotation than the 5 kinds, assigned per-slug rather than
// per-kind, so e.g. three "compare" posts in a row still land on three
// different accents. Shape (kind) still carries the content signal; color
// now carries per-post identity.
const ACCENT_ROTATION = [
  "text-chart-1",
  "text-chart-2",
  "text-chart-3",
  "text-chart-4",
  "text-chart-5",
  "text-primary",
] as const;

function accentForSlug(slug: string): string {
  const seed = seedFromSlug(slug);
  return ACCENT_ROTATION[seed % ACCENT_ROTATION.length];
}

type MarkProps = { accentClass: string; seed: number };

// Concentric ripples from a center point — a direct, quiet nod to the
// product name, used as the default/general-CI mark. The seed offsets the
// center so two "signal" posts don't ripple from the exact same spot.
function SignalMark({ accentClass, seed }: MarkProps) {
  const cx = 130 + (seed % 3) * 20;
  const cy = 110 + (seed % 5) * 4;
  return (
    <svg viewBox="0 0 400 240" className="size-full" aria-hidden="true">
      <g className={accentClass} fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx={cx} cy={cy} r="28" opacity="0.9" />
        <circle cx={cx} cy={cy} r="58" opacity="0.6" />
        <circle cx={cx} cy={cy} r="90" opacity="0.35" />
        <circle cx={cx} cy={cy} r="124" opacity="0.18" />
      </g>
      <circle cx={cx} cy={cy} r="5" className={accentClass} fill="currentColor" />
    </svg>
  );
}

// Two offset panels meeting at a shared edge — one thing measured against
// another, for vs./alternatives-style posts. Seed flips which side is
// accented so a run of "compare" posts doesn't look like the same card.
function CompareMark({ accentClass, seed }: MarkProps) {
  const flip = seed % 2 === 1;
  const leftClass = flip ? accentClass : "text-border";
  const rightClass = flip ? "text-border" : accentClass;
  return (
    <svg viewBox="0 0 400 240" className="size-full" aria-hidden="true">
      <rect x="76" y="56" width="140" height="128" rx="10" className={leftClass} fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="184" y="56" width="140" height="128" rx="10" className={rightClass} fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="200" y1="70" x2="200" y2="170" className={accentClass} stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 5" opacity="0.6" />
      <circle cx="200" cy="120" r="15" className={accentClass} fill="currentColor" opacity="0.12" />
      <path d="M193 113 L207 127 M207 113 L193 127" className={accentClass} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// A short row of connected, checked-off steps — a runnable process, not
// just an idea. Seed varies how many steps read as "done" (2 or 3 of 4).
function ProcessMark({ accentClass, seed }: MarkProps) {
  const steps = [70, 160, 250, 340];
  const doneCount = 2 + (seed % 2);
  return (
    <svg viewBox="0 0 400 240" className="size-full" aria-hidden="true">
      <line x1="70" y1="120" x2="340" y2="120" className="text-border" stroke="currentColor" strokeWidth="1.5" />
      {steps.map((x, i) => (
        <g key={x}>
          <rect x={x - 20} y={100} width="40" height="40" rx="8" className={i < doneCount ? accentClass : "text-border"} fill="none" stroke="currentColor" strokeWidth="1.5" />
          {i < doneCount ? (
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
// mark. Bar heights are seeded per slug so no two "data" posts share the
// exact same trend line.
function DataMark({ accentClass, seed }: MarkProps) {
  const xs = [90, 140, 190, 240, 290];
  const bars = xs.map((x, i) => ({
    x,
    h: 45 + ((seed >> (i * 3)) % 6) * 14,
  }));
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
// diagnosis / "field notes" posts (scraping, infra). Seed rotates which
// direction the arc sweeps and where the caught points land.
function FieldMark({ accentClass, seed }: MarkProps) {
  const mirror = seed % 2 === 1;
  const arcPath = mirror
    ? "M150 120 L150 25 A95 95 0 0 0 78 62 Z"
    : "M150 120 L150 25 A95 95 0 0 1 222 62 Z";
  const armEnd: [number, number] = mirror ? [78, 62] : [222, 62];
  const dots: [number, number][] = mirror
    ? [[195, 70], [105, 165], [210, 150]]
    : [[105, 70], [195, 165], [90, 150]];
  return (
    <svg viewBox="0 0 400 240" className="size-full" aria-hidden="true">
      <g className="text-border" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="150" cy="120" r="95" />
      </g>
      <path d={arcPath} className={accentClass} fill="currentColor" opacity="0.14" />
      <line x1="150" y1="120" x2={armEnd[0]} y2={armEnd[1]} className={accentClass} stroke="currentColor" strokeWidth="1.5" />
      <circle cx="150" cy="120" r="4" className={accentClass} fill="currentColor" />
      {dots.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" className="text-border" fill="currentColor" />
      ))}
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

export function BlogVisual({ slug, kind, className }: { slug: string; kind: BlogVisualKind; className?: string }) {
  const Mark = MARKS[kind];
  const accentClass = accentForSlug(slug);
  const seed = seedFromSlug(slug);
  return (
    <div className={cn("relative overflow-hidden bg-secondary", className)}>
      <Mark accentClass={accentClass} seed={seed} />
    </div>
  );
}
