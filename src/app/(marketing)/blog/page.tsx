import Link from "next/link";
import { getAllPosts, readingTime } from "@/lib/posts";
import { formatDate } from "@/lib/date";
import { JsonLd, breadcrumbs } from "@/components/marketing/json-ld";
import { visualKindForSlug } from "@/components/marketing/blog-visual";
import { BlogList } from "@/components/marketing/blog-list";

// Public content that only changes when an admin publishes/edits a post
// (see src/app/api/admin/blog) — cached for 5 minutes instead of forced
// dynamic on every request, with revalidatePath firing immediately on
// publish/edit/delete so admin changes don't wait out the cache window.
export const revalidate = 300;

const SITE = "https://www.ripplewatch.ai";

const description = "Notes on competitive intelligence, win/loss analysis, and building a Momentum score that actually means something.";

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

export default async function BlogIndexPage() {
  const posts = await getAllPosts();

  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "Ripplewatch blog",
          url: `${SITE}/blog`,
          description,
          publisher: { "@type": "Organization", name: "Ripplewatch", url: SITE },
          blogPost: posts.slice(0, 20).map((p) => ({
            "@type": "BlogPosting",
            headline: p.title,
            url: `${SITE}/blog/${p.slug}`,
            datePublished: p.publishedAt,
          })),
        }}
      />
      <JsonLd data={breadcrumbs(SITE, [{ name: "Blog", path: "/blog" }])} />
      <section className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          Blog
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Competitive intelligence, written down
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">{description}</p>
      </section>

      {posts.length === 0 ? (
        <p className="mt-16 text-center text-sm text-muted-foreground">
          Nothing published yet, check back soon, or see the{" "}
          <Link href="/state-of-competitive-intelligence" className="text-primary underline underline-offset-2">
            competitive intelligence research
          </Link>{" "}
          in the meantime.
        </p>
      ) : (
        <BlogList
          posts={posts.map((p) => ({
            slug: p.slug,
            title: p.title,
            description: p.description,
            dateLabel: formatDate(p.publishedAt),
            minutes: readingTime(p.body),
            kind: visualKindForSlug(p.slug),
          }))}
        />
      )}
    </div>
  );
}
