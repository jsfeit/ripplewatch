import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPost, type PostBlock } from "@/lib/posts";
import { formatDate } from "@/lib/date";

export const dynamic = "force-dynamic";

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


function Block({ block, index }: { block: PostBlock; index: number }) {
  if (block.type === "h2") {
    return <h2 className="mt-8 text-lg font-semibold tracking-tight text-foreground">{block.text}</h2>;
  }
  if (block.type === "ul") {
    return (
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
        {block.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }
  return (
    <p className={index === 0 ? "text-muted-foreground" : "mt-3 text-muted-foreground"}>{block.text}</p>
  );
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
            "@type": "Article",
            headline: post.title,
            description: post.description,
            datePublished: post.publishedAt,
            dateModified: post.publishedAt,
            author: { "@type": "Organization", name: "Ripplewatch" },
            publisher: { "@type": "Organization", name: "Ripplewatch" },
            mainEntityOfPage: `${APP_URL}/blog/${post.slug}`,
          }),
        }}
      />
      <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Blog
      </Link>
      <p className="mt-6 text-xs text-muted-foreground">{formatDate(post.publishedAt)}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance">{post.title}</h1>
      <p className="mt-3 text-muted-foreground">{post.description}</p>

      <div className="mt-10 space-y-1 text-[15px] leading-relaxed">
        {post.body.map((block, i) => (
          <Block key={i} block={block} index={i} />
        ))}
      </div>
    </article>
  );
}
