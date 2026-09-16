import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getAllPosts, readingTime } from "@/lib/posts";
import { formatDate } from "@/lib/date";
import { Panel } from "@/components/ui/panel";
import { BlogVisual, blogVisualLabel, visualKindForSlug } from "@/components/marketing/blog-visual";

// Public content that only changes when an admin publishes/edits a post
// (see src/app/api/admin/blog) — cached for 5 minutes instead of forced
// dynamic on every request, with revalidatePath firing immediately on
// publish/edit/delete so admin changes don't wait out the cache window.
export const revalidate = 300;

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
  const [featured, ...rest] = posts;

  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
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
        <>
          {featured && (
            <Link href={`/blog/${featured.slug}`} className="group mt-14 block">
              <Panel className="grid overflow-hidden transition-colors group-hover:border-primary/40 sm:grid-cols-2">
                <BlogVisual kind={visualKindForSlug(featured.slug)} className="aspect-[16/10] sm:aspect-auto" />
                <div className="flex flex-col justify-center p-8 sm:p-10">
                  <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                    <span>Latest</span>
                    <span aria-hidden="true">·</span>
                    <span>{blogVisualLabel(visualKindForSlug(featured.slug))}</span>
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-balance group-hover:text-primary">
                    {featured.title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{featured.description}</p>
                  <div className="mt-6 flex items-center gap-2 text-sm font-medium text-foreground">
                    Read the post
                    <ArrowUpRight className="size-4 text-muted-foreground/60 transition-colors group-hover:text-primary" />
                  </div>
                </div>
              </Panel>
            </Link>
          )}

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((post) => {
              const kind = visualKindForSlug(post.slug);
              return (
                <Link key={post.slug} href={`/blog/${post.slug}`} className="group block h-full">
                  <Panel className="flex h-full flex-col overflow-hidden transition-colors group-hover:border-primary/40">
                    <BlogVisual kind={kind} className="aspect-[16/10]" />
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatDate(post.publishedAt)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{readingTime(post.body)} min read</span>
                      </div>
                      <h3 className="mt-2 text-base font-medium tracking-tight text-balance group-hover:text-primary">
                        {post.title}
                      </h3>
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                        {post.description}
                      </p>
                    </div>
                  </Panel>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
