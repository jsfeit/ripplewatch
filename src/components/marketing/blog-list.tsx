"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Search, X } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { CategoryTag, blogVisualLabel, type BlogVisualKind } from "@/components/marketing/blog-visual";

export type BlogListPost = {
  slug: string;
  title: string;
  description: string;
  dateLabel: string;
  minutes: number;
  kind: BlogVisualKind;
};

const KIND_ORDER: BlogVisualKind[] = ["signal", "compare", "process", "data", "field"];

// Every post is in the first render (the page is static and fully crawlable); filtering only hides cards in the browser.
export function BlogList({ posts }: { posts: BlogListPost[] }) {
  const [kind, setKind] = useState<BlogVisualKind | "all">("all");
  const [query, setQuery] = useState("");

  // /blog?topic=compare opens already filtered, so a filtered view can be linked to.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("topic");
    if (wanted && KIND_ORDER.includes(wanted as BlogVisualKind)) {
      // Reading the URL needs the browser, so it can only happen after load.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setKind(wanted as BlogVisualKind);
    }
  }, []);

  function choose(next: BlogVisualKind | "all") {
    setKind(next);
    const url = new URL(window.location.href);
    if (next === "all") url.searchParams.delete("topic");
    else url.searchParams.set("topic", next);
    window.history.replaceState(null, "", url);
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of posts) c[p.kind] = (c[p.kind] ?? 0) + 1;
    return c;
  }, [posts]);

  const needle = query.trim().toLowerCase();
  const filtering = kind !== "all" || needle.length > 0;
  const visible = posts.filter(
    (p) => (kind === "all" || p.kind === kind) && (!needle || `${p.title} ${p.description}`.toLowerCase().includes(needle))
  );
  const [featured, ...rest] = posts;
  const grid = filtering ? visible : rest;

  return (
    <>
      <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter posts by type">
          {(["all", ...KIND_ORDER] as const).map((k) => {
            const active = kind === k;
            const count = k === "all" ? posts.length : (counts[k] ?? 0);
            if (k !== "all" && count === 0) return null;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={active}
                onClick={() => choose(k)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {k === "all" ? "All" : blogVisualLabel(k)} <span className="opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search posts"
            aria-label="Search posts"
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground" aria-live="polite">
        {filtering ? `Showing ${visible.length} of ${posts.length} posts` : `${posts.length} posts`}
      </p>

      {!filtering && featured ? (
        <Link href={`/blog/${featured.slug}`} className="group mt-6 block">
          <Panel className="border-primary/25 bg-primary/[0.03] p-8 transition-colors group-hover:border-primary/40 sm:p-10">
            <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
              <span>Latest</span>
              <span aria-hidden="true">·</span>
              <CategoryTag slug={featured.slug} kind={featured.kind} />
            </div>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-balance group-hover:text-primary sm:text-3xl">
              {featured.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{featured.description}</p>
            <div className="mt-6 flex items-center gap-2 text-sm font-medium text-foreground">
              Read the post
              <ArrowUpRight className="size-4 text-muted-foreground/60 transition-colors group-hover:text-primary" />
            </div>
          </Panel>
        </Link>
      ) : null}

      {grid.length === 0 ? (
        <div className="mt-10 rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
          Nothing matches that.{" "}
          <button
            type="button"
            onClick={() => {
              choose("all");
              setQuery("");
            }}
            className="text-primary underline underline-offset-2"
          >
            Clear the filters
          </button>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {grid.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="group block h-full">
              <Panel className="flex h-full flex-col p-5 transition-colors group-hover:border-primary/40">
                <CategoryTag slug={post.slug} kind={post.kind} />
                <h3 className="mt-2 text-base font-medium tracking-tight text-balance group-hover:text-primary">{post.title}</h3>
                <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">{post.description}</p>
                <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{post.dateLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>{post.minutes} min read</span>
                </div>
              </Panel>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
