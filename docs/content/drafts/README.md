# Blog drafts

The blog has no draft state: a row in `blog_posts` is live the moment it exists. Drafts live here as
markdown with front matter, and `scripts/publish-draft.ts` puts them live.

```bash
npx tsx --conditions react-server scripts/publish-draft.ts docs/content/drafts/<file>.md           # dry run
npx tsx --conditions react-server scripts/publish-draft.ts docs/content/drafts/<file>.md --apply   # writes to production
```

| Draft | What it does | Status |
|---|---|---|
| `why-not-just-ask-claude.md` | New post. Dated 2026-10-16 (backdated at Jeremy's request) | waiting for go |
| `best-mcp-servers-sales-marketing.md` | New post. Set `publish_date` before applying | planned Mon 2026-10-26 |
| `pricing-study-key-findings.md` | Adds a Key findings list after the first paragraph of the pricing study | with PR #162 |
| `expand-competitor-analysis-101.md` | Replaces the body (289 words to about 740) | waiting for go |
| `expand-weekly-ci-review.md` | Replaces the body (298 words to about 700) | waiting for go |
| `expand-what-ci-software-automates.md` | Replaces the body (327 words to about 700) | waiting for go |

After a post goes live: request indexing in Search Console for its URL. The sitemap and llms.txt update on their own.
