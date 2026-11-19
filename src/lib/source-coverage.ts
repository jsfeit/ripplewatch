// Which sources are feeding a competitor's Momentum, and what to do about the ones that are not. Shown so a thin score
// is explained instead of mysterious ("hiring: working, pricing: missing, add their pricing page") and so the person
// is pointed at the one fix that would sharpen it. Pure, so the wording is testable.
//
// Only sources whose silence means a broken or missing read are listed. Product changes are left out on purpose: a
// changelog with no new entries is a quiet competitor, not an unreadable one, so it must not be reported as a gap.
export type CoverageSource = { id: string; label: string; working: boolean; fix: string | null };

type CompetitorLinks = {
  pricing_url: string | null;
  careers_url: string | null;
  github_repo: string | null;
  g2_url: string | null;
  capterra_url: string | null;
  trustpilot_url: string | null;
  appstore_id: string | null;
};
type History = { metric: string }[];
type Signals = { type: string }[];

export function sourceCoverage(links: CompetitorLinks, history: History, signals: Signals): CoverageSource[] {
  const has = (metric: string) => history.some((h) => h.metric === metric);
  const hasSignal = (...types: string[]) => signals.some((s) => types.includes(s.type));
  const anyReviewUrl = Boolean(links.g2_url || links.capterra_url || links.trustpilot_url || links.appstore_id);

  const list: CoverageSource[] = [
    {
      id: "hiring",
      label: "Hiring",
      working: has("open_role_count"),
      fix: links.careers_url ? "Their job board could not be read; check the careers page link in Settings" : "Add their careers page in Settings → Competitors",
    },
    {
      id: "pricing",
      label: "Pricing",
      working: has("lowest_price") || hasSignal("pricing"),
      fix: links.pricing_url ? "Their pricing page could not be read; it may hide prices or block automated reads" : "Add their pricing page in Settings → Competitors",
    },
    { id: "news", label: "News", working: hasSignal("news", "funding"), fix: null },
    {
      id: "reviews",
      label: "Reviews",
      working: has("review_rating"),
      fix: anyReviewUrl ? "Reviews are linked but not reading yet" : "Add their G2, Capterra, Trustpilot or App Store page in Settings → Competitors",
    },
    { id: "buzz", label: "Buzz", working: has("buzz_mentions"), fix: null },
  ];
  if (links.github_repo) list.push({ id: "github", label: "Code activity", working: has("github_commit_velocity"), fix: null });
  return list;
}

// One line for the assistant: what is missing, so it can say how far to trust the read and what to add.
export function coverageSummary(sources: CoverageSource[]): string | null {
  const missing = sources.filter((s) => !s.working && s.fix);
  if (missing.length === 0) return null;
  return `Not reading yet: ${missing.map((s) => s.label.toLowerCase()).join(", ")}. ${missing[0].fix}.`;
}
