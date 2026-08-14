import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { SupabaseNotConfigured } from "@/components/admin/not-configured";
import { BlogManager } from "@/components/admin/blog-manager";
import { blocksToText, type PostBlock } from "@/lib/posts";

export const metadata = { title: "Blog | Admin" };
export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-10">
        <SupabaseNotConfigured />
      </div>
    );
  }

  const supabase = createAdminClient();
  const { data } = await supabase.from("blog_posts").select("*").order("published_at", { ascending: false });

  const posts = (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    publishedAt: row.published_at,
    bodyText: blocksToText(Array.isArray(row.body) ? (row.body as PostBlock[]) : []),
  }));

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Blog</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {posts.length} post{posts.length === 1 ? "" : "s"}. Changes go live on ripplewatch.ai/blog immediately,
          no deploy needed.
        </p>
      </div>
      <BlogManager initialPosts={posts} />
    </div>
  );
}
