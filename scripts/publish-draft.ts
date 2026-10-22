// Publishes a drafted blog post from docs/content/drafts/*.md into the blog_posts table.
//
//   npx tsx --conditions react-server scripts/publish-draft.ts <draft.md>            (dry run: prints what would change)
//   npx tsx --conditions react-server scripts/publish-draft.ts <draft.md> --apply    (writes to production)
//
// The blog has no draft state: any row in blog_posts is live immediately, so drafts live as files
// until this script runs. Front matter fields:
//   action: new-post | replace-body | insert-after-first-block
//   slug, title, description, publish_date (YYYY-MM-DD, new posts only)
// 'replace-body' keeps the existing title/description/date and sets updated_at to now (a real edit).
import { readFileSync } from "node:fs";
import { textToBlocks, type PostBlock } from "@/lib/posts";

const [file, ...flags] = process.argv.slice(2);
const apply = flags.includes("--apply");
if (!file) {
  console.error("usage: publish-draft.ts <draft.md> [--apply]");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")])
);
const base = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json", Prefer: "return=representation" };

function parse(raw: string) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error("draft is missing front matter");
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).replace(/#.*$/, "").trim().replace(/^"|"$/g, "");
  }
  return { meta, body: m[2].trim() };
}

async function main() {
  const { meta, body } = parse(readFileSync(file, "utf8"));
  if (/\[DATA|TODO|TBD/.test(body)) throw new Error("draft still has a placeholder in it");
  if (body.includes("—")) throw new Error("draft contains an em dash");
  const blocks = textToBlocks(body);
  const slug = meta.slug;
  const existing = await (await fetch(`${base}/rest/v1/blog_posts?slug=eq.${slug}&select=id,body,title,published_at`, { headers })).json();
  const row = Array.isArray(existing) ? existing[0] : undefined;

  if (meta.action === "new-post") {
    if (row) throw new Error(`slug ${slug} already exists`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.publish_date ?? "")) throw new Error("publish_date must be YYYY-MM-DD for a new post");
    console.log(`NEW POST ${slug}: "${meta.title}" dated ${meta.publish_date}, ${blocks.length} blocks`);
    if (!apply) return console.log("(dry run, nothing written)");
    const r = await fetch(`${base}/rest/v1/blog_posts`, {
      method: "POST",
      headers,
      body: JSON.stringify({ slug, title: meta.title, description: meta.description, published_at: meta.publish_date, body: blocks }),
    });
    return console.log(r.status, r.ok ? "inserted" : await r.text());
  }

  if (!row) throw new Error(`no existing post with slug ${slug}`);
  let next: PostBlock[];
  if (meta.action === "replace-body") next = blocks;
  else if (meta.action === "insert-after-first-block") {
    const current = row.body as PostBlock[];
    if (JSON.stringify(current).includes(blocks[0] && "text" in blocks[0] ? (blocks[0] as { text: string }).text : "\u0000")) throw new Error("block already present");
    next = [current[0], ...blocks, ...current.slice(1)];
  } else throw new Error(`unknown action ${meta.action}`);

  console.log(`UPDATE ${slug} ("${row.title}"): ${(row.body as PostBlock[]).length} blocks -> ${next.length}, published_at ${row.published_at} unchanged`);
  if (!apply) return console.log("(dry run, nothing written)");
  const r = await fetch(`${base}/rest/v1/blog_posts?id=eq.${row.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ body: next, updated_at: new Date().toISOString() }),
  });
  console.log(r.status, r.ok ? "updated" : await r.text());
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
