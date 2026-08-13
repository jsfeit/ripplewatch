// Blog content — a typed array rather than MDX/a CMS, matching how
// comparisons.ts and tiers.ts already model structured marketing content
// in this codebase. Each post's body is a list of typed blocks (heading,
// paragraph, list) instead of markdown, so rendering stays a plain,
// type-checked switch in the post page rather than a parsing pipeline.
//
// Starts empty on purpose — this file is the scaffold, not the content.
// Add entries here once topics are picked; the index page, sitemap, and
// generateStaticParams all read from this array automatically.

export type PostBlock =
  | { type: "h2"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

export type PostEntry = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string; // ISO date, e.g. "2026-08-12"
  body: PostBlock[];
};

export const POSTS: PostEntry[] = [];

export function getPost(slug: string): PostEntry | undefined {
  return POSTS.find((p) => p.slug === slug);
}

// Newest first — publishedAt is a plain ISO date string, safe to compare
// lexicographically without parsing.
export function sortedPosts(): PostEntry[] {
  return [...POSTS].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}
