# Awesome-list submissions (drafts, nothing opened)

Prepared 2026-10-23. Nothing here has been submitted. Each submission is a pull request on someone else's
repository, so it needs Jeremy's go first.

## Where it belongs

**Target: `punkpeye/awesome-remote-mcp-servers`** (about 1.8k stars, active). Category: **Marketing**.

Not `punkpeye/awesome-mcp-servers` (the 97k-star main list). Its rules say it is only for servers with a
public repo that you install and run yourself, and that remote-only servers belong in the remote list instead.

Why Marketing: the section already holds competitive-intelligence tools (for example "Competitive intelligence
on B2B SaaS markets"). Sales is a smaller section about prospecting. Entries are alphabetical, case-insensitive,
so Ripplewatch goes between **Revup** and **Rumoro**.

## The entry

```markdown
- [Ripplewatch](https://www.ripplewatch.ai/connect) `https://www.ripplewatch.ai/api/mcp`
  [![Ripplewatch MCP connector](https://glama.ai/mcp/connectors/<GLAMA_ID>/badges/score.svg)](https://glama.ai/mcp/connectors/<GLAMA_ID>)
  🔐 - Competitor momentum, pricing, hiring and news, scored against your own won and lost deals.
```

- Description is 90 characters (limit 120), one sentence ending in a period.
- 🔐 means OAuth. Their check confirmed against our endpoint: an unauthenticated `initialize` returns `401` with
  `WWW-Authenticate: Bearer resource_metadata=...`, which their workflow reads as OAuth.
- Name links to the homepage, not the GitHub repo, as their rules ask.
- `<GLAMA_ID>` is the reverse-DNS identifier from the connector's URL on Glama, for example `ai.ripplewatch/ripplewatch`.
  Copy it exactly from the page after the Glama listing exists. Their CI fails a badge that points at a missing connector.

## PR

**Title:** `Add Ripplewatch (competitive intelligence)`

**Body:**

```markdown
**Server:** Ripplewatch, a competitive intelligence analyst for Claude and ChatGPT: competitor momentum, pricing, hiring and news, scored against the user's own won and lost deals.
**Endpoint:** `https://www.ripplewatch.ai/api/mcp`

Hosted, Streamable HTTP, OAuth with dynamic client registration. Also listed in the official MCP Registry as `ai.ripplewatch/ripplewatch`. Docs and manifest: https://github.com/jsfeit/ripplewatch-mcp

- [x] The endpoint is public and answers an MCP `initialize` request (401 with a Bearer challenge until the user signs in)
- [x] Entry is in the correct category, in alphabetical order
- [x] Entry has its Glama connector badge on the second line
- [x] Auth marker matches what the endpoint actually does
```

## Checklist before opening (their rules)

1. **Glama connector exists** (Jeremy is doing this at glama.ai/mcp/connectors). Get the exact identifier and check the
   badge image loads.
2. **Star the repository from the account that opens the PR.** Required: PRs from accounts that haven't starred it are not merged.
3. Fork, branch `add-ripplewatch`, edit `README.md` only, insert the entry in Marketing between Revup and Rumoro.
4. Open the PR with the title and body above. Their CI then comments on whether the endpoint answered, the auth it detected
   and whether the badge resolves. If it disagrees with the entry, fix the entry.
5. Optional: join their Discord and ask for the server-author flair once it merges.

## One risk

Their rules say servers that "fail the handshake behind a paywall are not listed", and that listings should be usable by
anyone. Ripplewatch answers the handshake and anyone can sign up, but a new user has to pay ($79 to start) before the tools
work. Their automated check will pass, so this is only a judgment call for a human maintainer. The honest description does
not hide it, and the README in the public repo states the pricing.

## Other lists (lower priority)

- `TensorBlock/awesome-mcp-servers` (about 945 stars, active): structured data files instead of a README. Worth a look
  after the first one merges.
- `appcypher/awesome-mcp-servers`: archived, not accepting changes.
- `wong2/awesome-mcp-servers`: README points submissions to mcpservers.org instead of PRs.
