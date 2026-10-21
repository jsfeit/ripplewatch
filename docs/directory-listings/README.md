# MCP directory listings for Ripplewatch

Prepared 2026-10-20. Nothing has been submitted yet. Every directory needs a login or
account that only you can create, so each one below is down to a few minutes of clicking.

## Verified today (against production)

- `https://www.ripplewatch.ai/api/mcp` answers an unauthenticated request with HTTP 401
  and a `WWW-Authenticate: Bearer resource_metadata=...` header. That is the correct
  behaviour for OAuth servers (Smithery's scanner fails on 403, not on 401).
- `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`
  both return valid metadata, including a dynamic client registration endpoint.
- The server reports itself as `ripplewatch` v0.1.0 and exposes 16 tools.

## Reviewer access (done)

A funded demo account exists in production: `directory-review@ripplewatch.ai`
(company "Fieldnote", $100 wallet, three competitors and eight logged deals, demo mode,
no real mailbox). Sign in at https://www.ripplewatch.ai/login. The password is in
`.reviewer-credentials.local` in this folder (gitignored). Paste it into the
"test credentials" field of each review form. It was created with
`scripts/seed-directory-reviewer.ts`; the OpenAI reviewer account is untouched.

## Listing copy (reuse everywhere)

**Name:** Ripplewatch

**One line (under 100 characters):**
Competitive analyst inside Claude or ChatGPT. Ask who's heating up and why.

**Short description (about 300 characters):**
Ripplewatch turns Claude or ChatGPT into your competitive analyst. It watches your
competitors' pricing, hiring, launches, press and reviews, scores each one with a
Momentum number from -100 to +100, and checks it all against your own won and lost deals.
No dashboard, no new tab.

**Long description:**
Ripplewatch is a competitive intelligence analyst that lives inside the AI you already use.
Connect it once, then just ask: "Is Northlane heating up?", "What changed this week?",
"Why are we losing to Brightwell?"

- Momentum score per competitor, from ten inputs (hiring, pricing activity, product
  changes, press and funding, relevance trend, win rate against you, review sentiment,
  Reddit/HN buzz, plus opt-in GitHub and ad activity).
- Signals are scored against your own positioning, buyer and win/loss history, so answers
  get more specific the more you tell it.
- Tell it how a deal went, import a CSV, or log competitor mentions from sales calls.

Pricing: $29 a month plus usage you prepay for. A free read on one competitor works with
no signup.

**Category tags:** competitive intelligence, sales, marketing, market research, analytics

**Links**
- Site: https://www.ripplewatch.ai
- Server URL: https://www.ripplewatch.ai/api/mcp (streamable HTTP, OAuth)
- Setup guide: https://www.ripplewatch.ai/connect/claude-and-chatgpt
- Docs: https://www.ripplewatch.ai/docs/api
- Pricing: https://www.ripplewatch.ai/pricing
- Privacy: https://www.ripplewatch.ai/privacy
- Terms: https://www.ripplewatch.ai/terms
- Support: https://www.ripplewatch.ai/contact

**Tools (16):** start_here, how_to_use, get_briefing, ask, list_competitors, get_competitor,
get_momentum, get_trends, add_competitor, set_context, log_win_loss, import_win_loss,
log_customer_feedback, log_call_mentions, get_next_step, get_slack_setup_link

**Example prompts**
1. "Give me my competitive briefing for this week."
2. "Is Northlane heating up? What's driving it?"
3. "We lost Acme to Brightwell on price. Log it."

**Assets still needed:** square logo (512x512 PNG), one screenshot of the Momentum chat
(the home page hero is a good source).

## Submit, in this order

### 1. Official MCP Registry (DONE 2026-10-20)
Published as `ai.ripplewatch/ripplewatch` v0.1.0. Domain ownership was proved with a TXT
record on ripplewatch.ai in Cloudflare (`v=MCPv1; k=ed25519; p=...`, public key only; the
private key is in `~/mcp-keys/key.pem`, outside the repo). Check it at
https://registry.modelcontextprotocol.io/v0.1/servers?search=ripplewatch

To publish a new version later: bump `version` in `server.json`, then
`mcp-publisher login dns --domain ripplewatch.ai --private-key <key>` and
`mcp-publisher publish`. Descriptions are capped at 100 characters.

### 2. Smithery (about 10 minutes)
1. Go to https://smithery.ai/new and sign in (GitHub is fine).
2. Paste `https://www.ripplewatch.ai/api/mcp` as the server URL and continue.
3. Smithery scans for tools. Because the server needs OAuth, it will ask you to sign in:
   use `directory-review@ripplewatch.ai` and the password from the credentials file.
4. Fill in the name, description and logo from the listing copy above, then publish.
5. If the scan fails with a 403, the cause is Vercel's bot protection, since the server
   itself correctly answers 401. Allow the User-Agent `SmitheryBot/1.0`, or publish a
   static card at `/.well-known/mcp/server-card.json` (needs `serverInfo` name and version).
6. After publishing: Settings > Verification, to finish the official-vendor checklist.

### 3. PulseMCP, mcp.so, Glama
- **PulseMCP:** reads from the official registry, so Ripplewatch (published 2026-10-20)
  should appear on its own within a day or so. Search pulsemcp.com for "ripplewatch" then.
- **mcp.so:** its submit form asks for a *repository URL* and offers a $39 paid fast-track.
  Ripplewatch's repo is private, so skip it unless you want to pay and give it a public repo.
- **Glama:** has an "Add Server" button at glama.ai/mcp/servers, but it indexes GitHub
  repos, so the same private-repo problem applies. Skip for now.

### 4. Anthropic Claude connectors directory
Portal: https://claude.ai/directory/manage > Submit new > MCP connector. Any paid Claude
plan can submit (no Team or Enterprise plan needed). Review criteria:
https://claude.com/docs/connectors/building/review-criteria

Already true: every tool has a `title` and a `readOnlyHint`/`destructiveHint` annotation,
and the server uses OAuth with dynamic client registration.

Answers to paste, by portal step:
1. **Connection:** `https://www.ripplewatch.ai/api/mcp`
2. **Tools:** syncs automatically. Nothing to enter.
3. **Listing:**
   - Name: Ripplewatch
   - One-liner (under 200): Competitive analyst inside Claude or ChatGPT. Ask who's heating up, why you're losing deals, and what changed, scored against your own win/loss history.
   - Description (under 2,000): use the long description above.
   - Categories: pick the closest to sales, marketing, research.
   - Docs URL: https://www.ripplewatch.ai/docs/api
   - Privacy URL: https://www.ripplewatch.ai/privacy
   - Support: https://www.ripplewatch.ai/contact
   - Icon: ripplewatch-logo-512.png (this folder)
   - Slug: `ripplewatch` (permanent once published)
4. **Use cases:** briefings on competitors, asking "is X heating up", logging won/lost deals.
   Users need a Ripplewatch account ($29/month plus prepaid usage). Reads and writes data.
5. **Company:** Ripplewatch, https://www.ripplewatch.ai, your email as contact.
6. **Authentication:** OAuth with dynamic client registration.
7. **Data handling:** your own API (first-party). No health data, no sponsored content.
8. **Test and launch:** reviewer login = `directory-review@ripplewatch.ai` and the password in
   `.reviewer-credentials.local`, sign in at https://www.ripplewatch.ai/login, then connect
   the server. Then add the server as a custom connector in Claude yourself and call each
   tool once, because this step asks you to confirm you did.
9. **Compliance:** seven acknowledgments, all required. Read each one honestly.
10. **Review and submit.**
Escalations: mcp-review@anthropic.com. Status shows in the portal.
