import { avatarDotColor, cn } from "@/lib/utils";

// The content taxonomy each post is tagged with — was previously paired
// with a generated abstract line-art cover mark per kind (checkmarks,
// concentric circles, bar charts). That mark system is gone: even with
// per-post color/geometry seeding, a small fixed set of icon shapes
// repeating across a grid read as generic and made the blog look worse,
// not better, so cards are typography-only now (see CategoryTag below).
// The taxonomy itself stayed, it's still a real, useful signal (used for
// the eyebrow label and for "More from the blog" grouping).
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
// label actually fits what the post is about. New posts default to
// "signal" until added below.
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
  "you-cant-build-a-battlecard-in-30-seconds": "field",
  "dashboards-and-alerts-are-dead": "field",
};

export function visualKindForSlug(slug: string): BlogVisualKind {
  return BLOG_VISUAL_KIND[slug] ?? "signal";
}

// The eyebrow tag replacing the old cover-mark grid: a colored dot (same
// per-slug palette as the avatar dots used elsewhere in the app, via
// avatarDotColor) plus the kind label as plain text. Carries the same
// "what kind of post is this, and it isn't a repeat of the one above it"
// signal without needing generated artwork.
export function CategoryTag({ slug, kind, className }: { slug: string; kind: BlogVisualKind; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground", className)}>
      <span className={cn("size-1.5 rounded-full", avatarDotColor(slug))} />
      {KIND_LABEL[kind]}
    </span>
  );
}
