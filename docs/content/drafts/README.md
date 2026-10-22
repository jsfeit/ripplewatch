# Blog drafts

The blog has no draft state: a row in `blog_posts` is live the moment it exists. Drafts live here as
markdown with front matter, and `scripts/publish-draft.ts` puts them live.

```bash
npx tsx --conditions react-server scripts/publish-draft.ts docs/content/drafts/<file>.md           # dry run
npx tsx --conditions react-server scripts/publish-draft.ts docs/content/drafts/<file>.md --apply   # writes to production
```

| Draft | What it does | Status |
|---|---|---|
| `why-not-just-ask-claude.md` | New post. Dated 2026-10-16 (backdated at Jeremy's request) | published 2026-10-22 |
| `best-mcp-servers-sales-marketing.md` | New post. Set `publish_date` before applying | scheduled Mon 2026-10-26 |
| `pricing-study-key-findings.md` | Adds a Key findings list after the first paragraph of the pricing study | scheduled Wed 2026-10-28, with PR #162 |
| `expand-competitor-analysis-101.md` | Replaces the body (289 words to about 740) | scheduled Tue 2026-10-27 |
| `expand-weekly-ci-review.md` | Replaces the body (298 words to about 700) | scheduled Thu 2026-10-29 |
| `expand-what-ci-software-automates.md` | Replaces the body (327 words to about 700) | scheduled Fri 2026-10-30 |

After a post goes live: request indexing in Search Console for its URL. The sitemap and llms.txt update on their own.
