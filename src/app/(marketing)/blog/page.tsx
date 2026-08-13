import Link from "next/link";
import { sortedPosts } from "@/lib/posts";
import { formatDate } from "@/lib/date";

const description = "Notes on competitive intelligence, win/loss analysis, and building a relevance-first alerting system.";

export const metadata = {
  title: "Blog",
  description,
  alternates: {
    canonical: "/blog",
    types: { "application/rss+xml": "/blog/rss.xml" },
  },
  openGraph: { title: "Blog | Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: "Blog | Ripplewatch", description, images: ["/opengraph-image"] },
};

export default function BlogIndexPage() {
  const posts = sortedPosts();

  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Blog</h1>
      <p className="mt-2 text-muted-foreground">{description}</p>

      {posts.length === 0 ? (
        <p className="mt-12 text-sm text-muted-foreground">
          Nothing published yet — check back soon, or see the{" "}
          <Link href="/state-of-competitive-intelligence" className="text-primary underline underline-offset-2">
            competitive intelligence research
          </Link>{" "}
          in the meantime.
        </p>
      ) : (
        <ul className="mt-10 space-y-8">
          {posts.map((post) => (
            <li key={post.slug} className="border-b border-border pb-8 last:border-none">
              <Link href={`/blog/${post.slug}`} className="group">
                <p className="text-xs text-muted-foreground">{formatDate(post.publishedAt)}</p>
                <h2 className="mt-1 text-xl font-medium tracking-tight group-hover:text-primary">{post.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{post.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
