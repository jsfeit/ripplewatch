import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { textToBlocks } from "@/lib/posts";

// Gated by middleware (/api/admin/:path* requires an admin session).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const slug: unknown = body?.slug;
  const title: unknown = body?.title;
  const description: unknown = body?.description;
  const publishedAt: unknown = body?.publishedAt;
  const bodyText: unknown = body?.bodyText;

  if (typeof slug !== "string" || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Slug must be lowercase letters, numbers, and hyphens only." }, { status: 400 });
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  if (typeof description !== "string" || !description.trim()) {
    return NextResponse.json({ error: "Description is required." }, { status: 400 });
  }
  if (typeof publishedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) {
    return NextResponse.json({ error: "Published date must be YYYY-MM-DD." }, { status: 400 });
  }
  if (typeof bodyText !== "string" || !bodyText.trim()) {
    return NextResponse.json({ error: "Body is required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("blog_posts")
    .insert({
      slug,
      title: title.trim(),
      description: description.trim(),
      published_at: publishedAt,
      body: textToBlocks(bodyText),
    })
    .select("id")
    .single();

  if (error) {
    const message = error.code === "23505" ? `A post with slug "${slug}" already exists.` : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ id: data.id });
}
