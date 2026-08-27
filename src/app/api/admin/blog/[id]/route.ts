import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { textToBlocks } from "@/lib/posts";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
  const { data: existing } = await admin.from("blog_posts").select("slug").eq("id", id).maybeSingle();
  const { error } = await admin
    .from("blog_posts")
    .update({
      slug,
      title: title.trim(),
      description: description.trim(),
      published_at: publishedAt,
      body: textToBlocks(bodyText),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    const message = error.code === "23505" ? `A post with slug "${slug}" already exists.` : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
  if (existing && existing.slug !== slug) revalidatePath(`/blog/${existing.slug}`);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: existing } = await admin.from("blog_posts").select("slug").eq("id", id).maybeSingle();
  const { error } = await admin.from("blog_posts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  revalidatePath("/blog");
  if (existing) revalidatePath(`/blog/${existing.slug}`);

  return NextResponse.json({ ok: true });
}
