"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

export type AdminPost = {
  id: string;
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  bodyText: string;
};

type FormState = {
  id: string | null; // null = creating a new post
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  bodyText: string;
};

const EMPTY_FORM: FormState = { id: null, slug: "", title: "", description: "", publishedAt: "", bodyText: "" };

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function BlogManager({ initialPosts }: { initialPosts: AdminPost[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [form, setForm] = useState<FormState | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function startCreate() {
    setForm({ ...EMPTY_FORM, publishedAt: todayIso() });
    setSlugTouched(false);
    setError("");
  }

  function startEdit(post: AdminPost) {
    setForm({
      id: post.id,
      slug: post.slug,
      title: post.title,
      description: post.description,
      publishedAt: post.publishedAt,
      bodyText: post.bodyText,
    });
    setSlugTouched(true);
    setError("");
  }

  function updateTitle(title: string) {
    setForm((f) => (f ? { ...f, title, slug: slugTouched ? f.slug : slugify(title) } : f));
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setError("");

    const payload = {
      slug: form.slug.trim(),
      title: form.title.trim(),
      description: form.description.trim(),
      publishedAt: form.publishedAt,
      bodyText: form.bodyText,
    };

    const res = await fetch(form.id ? `/api/admin/blog/${form.id}` : "/api/admin/blog", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      setSaving(false);
      return;
    }

    const saved: AdminPost = { id: form.id ?? data.id, ...payload };
    setPosts((prev) => {
      const next = form.id ? prev.map((p) => (p.id === form.id ? saved : p)) : [saved, ...prev];
      return [...next].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
    });
    setSaving(false);
    setForm(null);
  }

  async function deletePost(id: string) {
    if (!confirm("Delete this post? This can't be undone.")) return;
    setDeletingId(id);
    const res = await fetch(`/api/admin/blog/${id}`, { method: "DELETE" });
    if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== id));
    setDeletingId(null);
  }

  return (
    <div className="space-y-6">
      {form ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{form.id ? "Edit post" : "New post"}</h2>
              <Button variant="ghost" size="icon" onClick={() => setForm(null)}>
                <X className="size-4" />
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="post-title">Title</Label>
              <Input id="post-title" value={form.title} onChange={(e) => updateTitle(e.target.value)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="post-slug">Slug</Label>
                <Input
                  id="post-slug"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setForm((f) => (f ? { ...f, slug: e.target.value } : f));
                  }}
                />
                <p className="text-xs text-muted-foreground">ripplewatch.ai/blog/{form.slug || "…"}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="post-date">Published date</Label>
                <Input
                  id="post-date"
                  type="date"
                  value={form.publishedAt}
                  onChange={(e) => setForm((f) => (f ? { ...f, publishedAt: e.target.value } : f))}
                />
                <p className="text-xs text-muted-foreground">Controls sort order and the date shown on the post.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="post-description">Description</Label>
              <Textarea
                id="post-description"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => (f ? { ...f, description: e.target.value } : f))}
              />
              <p className="text-xs text-muted-foreground">Shown on the blog index and used for SEO/social previews.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="post-body">Body</Label>
              <Textarea
                id="post-body"
                rows={16}
                className="font-mono text-xs"
                value={form.bodyText}
                onChange={(e) => setForm((f) => (f ? { ...f, bodyText: e.target.value } : f))}
              />
              <p className="text-xs text-muted-foreground">
                Plain paragraphs, separated by a blank line. Start a line with <code>## </code> for a heading, or
                start every line in a paragraph with <code>- </code> for a bulleted list.
              </p>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex items-center gap-2">
              <Button onClick={save} disabled={saving || !form.title || !form.slug || !form.bodyText}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {form.id ? "Save changes" : "Publish"}
              </Button>
              <Button variant="outline" onClick={() => setForm(null)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={startCreate}>
          <Plus className="size-4" />
          New post
        </Button>
      )}

      <div className="space-y-2">
        {posts.map((post) => (
          <div key={post.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{post.title}</p>
              <p className="text-xs text-muted-foreground">
                {post.publishedAt} · /blog/{post.slug}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => startEdit(post)}>
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => deletePost(post.id)} disabled={deletingId === post.id}>
                {deletingId === post.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              </Button>
            </div>
          </div>
        ))}
        {posts.length === 0 ? <p className="text-sm text-muted-foreground">No posts yet.</p> : null}
      </div>
    </div>
  );
}
