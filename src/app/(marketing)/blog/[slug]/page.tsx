import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { getAllPosts, getPost, readingTime, type PostBlock, type PostEntry } from "@/lib/posts";
import { formatDate } from "@/lib/date";
import { QuizCta } from "@/components/marketing/quiz-cta";
import { EmailCaptureForm } from "@/components/marketing/email-capture-form";
import { Panel } from "@/components/ui/panel";
import { CategoryTag, visualKindForSlug } from "@/components/marketing/blog-visual";
import { avatarColor } from "@/lib/utils";

// Same caching rationale as the blog index — see that file.
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { title: `${post.title} | Ripplewatch`, description: post.description, images: ["/opengraph-image"] },
    twitter: {
      card: "summary_large_image",
      title: `${post.title} | Ripplewatch`,
      description: post.description,
      images: ["/opengraph-image"],
    },
  };
}


// Same "markdown-lite" spirit as textToBlocks in lib/posts.ts (## headings,
// - list items) — just enough syntax to be easy to type in the admin
// textarea, not a real markdown parser. [text](url) is the one inline
// pattern supported, split out of the surrounding plain text and rendered
// as a link; everything else stays a plain string, so no HTML injection
// risk from post body text.
const LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g;

function renderInlineText(text: string) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(LINK_PATTERN)) {
    const [full, label, href] = match;
    const start = match.index ?? 0;
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));

    const isInternal = href.startsWith("/");
    nodes.push(
      isInternal ? (
        <Link key={key++} href={href} className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
          {label}
        </Link>
      ) : (
        <a
          key={key++}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
        >
          {label}
        </a>
      ),
    );
    lastIndex = start + full.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

  return nodes;
}

function Block({ block, index }: { block: PostBlock; index: number }) {
  if (block.type === "h2") {
    return (
      <h2 className="mt-10 border-l-2 border-primary/40 pl-4 text-xl font-semibold tracking-tight text-foreground">
        {block.text}
      </h2>
    );
  }
  if (block.type === "ul") {
    return (
      <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-primary/50">
        {block.items.map((item, i) => (
          <li key={i}>{renderInlineText(item)}</li>
        ))}
      </ul>
    );
  }
  return (
    <p className={index === 0 ? "text-lg leading-relaxed text-foreground" : "mt-4"}>
      {renderInlineText(block.text)}
    </p>
  );
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// FAQPage schema is deliberately opt-in, not automatic for every post that
// happens to have question-form subheads — most posts here are one
// continuous argument broken into labeled sections, not a real list of
// discrete buyer questions, and Google's own guidance (and past FAQ
// rich-result crackdowns) treats that distinction as real, not cosmetic.
// Only genuine multi-question buyer-evaluation posts go in this set.
const FAQPAGE_SLUGS = new Set([
  "what-a-competitive-intelligence-dashboard-should-track",
  "g2-vs-gartner-vs-building-your-own-win-loss-process",
]);

// Structured-data answers want plain text — strips the [text](url) inline
// links this content uses down to just their visible text, same spirit as
// the FAQ page's own stripHtml for its (HTML-based) answer strings.
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\([^)]+\)/g;
function toPlainText(text: string): string {
  return text.replace(MARKDOWN_LINK_PATTERN, "$1");
}

// Pairs each h2 (already phrased as a question) with the plain-text
// content of every block until the next h2, for the FAQPage schema above.
function buildFaqEntities(body: PostBlock[]): { "@type": "Question"; name: string; acceptedAnswer: { "@type": "Answer"; text: string } }[] {
  const entities: { "@type": "Question"; name: string; acceptedAnswer: { "@type": "Answer"; text: string } }[] = [];
  let current: { name: string; parts: string[] } | null = null;

  for (const block of body) {
    if (block.type === "h2") {
      if (current) entities.push(toFaqEntity(current));
      current = { name: block.text, parts: [] };
    } else if (current) {
      if (block.type === "p") current.parts.push(toPlainText(block.text));
      else if (block.type === "ul") current.parts.push(block.items.map(toPlainText).join(" "));
    }
  }
  if (current) entities.push(toFaqEntity(current));
  return entities;
}

function toFaqEntity(section: { name: string; parts: string[] }) {
  return {
    "@type": "Question" as const,
    name: section.name,
    acceptedAnswer: { "@type": "Answer" as const, text: section.parts.join(" ") },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-3xl px-6 py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.description,
            datePublished: post.publishedAt,
            // Real last-edit time (blog_posts.updated_at, written by the
            // admin editor on every save) — previously hardcoded to
            // publishedAt, which meant this field was always wrong for any
            // post that had ever been edited after it went live.
            dateModified: post.updatedAt,
            // Every post is written by the founder — a named Person (matching
            // the About page's Person schema) is a stronger E-E-A-T/AEO
            // signal than attributing authorship to the org itself.
            author: {
              "@type": "Person",
              name: "Jeremy Feit",
              url: `${APP_URL}/about`,
            },
            publisher: {
              "@type": "Organization",
              name: "Ripplewatch",
              logo: { "@type": "ImageObject", url: `${APP_URL}/opengraph-image` },
            },
            mainEntityOfPage: `${APP_URL}/blog/${post.slug}`,
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: APP_URL },
              { "@type": "ListItem", position: 2, name: "Blog", item: `${APP_URL}/blog` },
              { "@type": "ListItem", position: 3, name: post.title, item: `${APP_URL}/blog/${post.slug}` },
            ],
          }),
        }}
      />
      {FAQPAGE_SLUGS.has(post.slug) ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: buildFaqEntities(post.body),
            }),
          }}
        />
      ) : null}
      <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Blog
      </Link>

      <div className="mt-6">
        <CategoryTag slug={post.slug} kind={visualKindForSlug(post.slug)} />
      </div>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{post.title}</h1>
      <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{post.description}</p>

      <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
        <Link href="/about" className="flex items-center gap-2 hover:text-foreground">
          <span className={`flex size-6 items-center justify-center rounded-full text-[11px] font-semibold ${avatarColor("Jeremy Feit")}`}>
            JF
          </span>
          Jeremy Feit
        </Link>
        <span aria-hidden="true">·</span>
        <span>{formatDate(post.publishedAt)}</span>
        <span aria-hidden="true">·</span>
        <span>{readingTime(post.body)} min read</span>
      </div>

      <div className="mt-10 space-y-1 text-[15px] leading-relaxed text-muted-foreground">
        {post.body.map((block, i) => (
          <Block key={i} block={block} index={i} />
        ))}
      </div>

      <div className="mt-16">
        <EmailCaptureForm capturePoint="blog" />
      </div>

      <div className="mt-8">
        <QuizCta />
      </div>

      <RelatedPosts current={post} />
    </article>
  );
}

async function RelatedPosts({ current }: { current: PostEntry }) {
  const posts = await getAllPosts();
  const currentKind = visualKindForSlug(current.slug);
  const others = posts.filter((p) => p.slug !== current.slug);
  const sameKindFirst = [
    ...others.filter((p) => visualKindForSlug(p.slug) === currentKind),
    ...others.filter((p) => visualKindForSlug(p.slug) !== currentKind),
  ].slice(0, 3);

  if (sameKindFirst.length === 0) return null;

  return (
    <div className="mt-16 border-t border-border pt-12">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">More from the blog</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        {sameKindFirst.map((post) => (
          <Link key={post.slug} href={`/blog/${post.slug}`} className="group block">
            <Panel className="flex h-full flex-col p-4 transition-colors group-hover:border-primary/40">
              <CategoryTag slug={post.slug} kind={visualKindForSlug(post.slug)} />
              <h3 className="mt-2 text-sm font-medium tracking-tight text-balance group-hover:text-primary">
                {post.title}
              </h3>
              <span className="mt-auto flex items-center gap-1 pt-3 text-xs text-muted-foreground/70 group-hover:text-primary">
                Read
                <ArrowUpRight className="size-3" />
              </span>
            </Panel>
          </Link>
        ))}
      </div>
    </div>
  );
}
