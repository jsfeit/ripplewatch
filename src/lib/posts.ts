import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import type { Database } from "@/lib/supabase/types";

// Blog content lives in the blog_posts table (migration 0036) so it can be
// edited from /admin/blog without a code deploy. The typed block model
// (heading/paragraph/list) is unchanged from the original static-file
// version — only where it's stored changed, not its shape.

export type PostBlock =
  | { type: "h2"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

export type PostEntry = {
  id: string;
  slug: string;
  title: string;
  description: string;
  publishedAt: string; // ISO date, e.g. "2026-08-12"
  body: PostBlock[];
};

type BlogPostRow = Database["public"]["Tables"]["blog_posts"]["Row"];

function rowToPost(row: BlogPostRow): PostEntry {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    publishedAt: row.published_at,
    body: Array.isArray(row.body) ? (row.body as PostBlock[]) : [],
  };
}

export async function getAllPosts(): Promise<PostEntry[]> {
  const supabase = createPublicClient();
  const { data } = await supabase.from("blog_posts").select("*").order("published_at", { ascending: false });
  return (data ?? []).map(rowToPost);
}

export async function getPost(slug: string): Promise<PostEntry | undefined> {
  const supabase = createPublicClient();
  const { data } = await supabase.from("blog_posts").select("*").eq("slug", slug).maybeSingle();
  return data ? rowToPost(data) : undefined;
}

// --- Markdown-lite <-> blocks, for the admin textarea editor ---------
// Deliberately not real markdown: just enough structure (## heading, -
// list items, blank-line-separated paragraphs) to be easy to type and to
// round-trip losslessly, without pulling in a markdown parser for three
// block types.

export function blocksToText(blocks: PostBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === "h2") return `## ${b.text}`;
      if (b.type === "ul") return b.items.map((item) => `- ${item}`).join("\n");
      return b.text;
    })
    .join("\n\n");
}

export function textToBlocks(text: string): PostBlock[] {
  const blocks: PostBlock[] = [];
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  for (const para of paragraphs) {
    const lines = para.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 1 && lines[0].startsWith("## ")) {
      blocks.push({ type: "h2", text: lines[0].slice(3).trim() });
    } else if (lines.every((l) => l.startsWith("- "))) {
      blocks.push({ type: "ul", items: lines.map((l) => l.slice(2).trim()) });
    } else {
      blocks.push({ type: "p", text: lines.join(" ") });
    }
  }

  return blocks;
}
