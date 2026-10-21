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

### 1. Official MCP Registry (about 15 minutes)
Other directories read from this one, so do it first. `server.json` in this folder is
ready. Its name, `ai.ripplewatch/ripplewatch`, is the reverse of ripplewatch.ai, which
the registry requires for domain-based login. Commands are from the registry's docs
(modelcontextprotocol.io/registry/authentication). It is still a preview, so re-check
if anything errors.

```bash
brew install mcp-publisher
mkdir -p ~/mcp-keys && cd ~/mcp-keys          # keep the private key OUT of the repo

# 1. make a key and print the DNS record to add
openssl genpkey -algorithm Ed25519 -out key.pem
PUBLIC_KEY="$(openssl pkey -in key.pem -pubout -outform DER | tail -c 32 | base64)"
echo "ripplewatch.ai. IN TXT \"v=MCPv1; k=ed25519; p=${PUBLIC_KEY}\""
```

2. Add that as a **TXT record on ripplewatch.ai** (name `@`, the value inside the quotes)
   in wherever the domain's DNS lives (Vercel > Domains > ripplewatch.ai > DNS Records,
   if it's hosted there). Wait 5 to 10 minutes.

```bash
# 3. log in and publish
PRIVATE_KEY="$(openssl pkey -in key.pem -noout -text | grep -A3 "priv:" | tail -n +2 | tr -d ' :\n')"
mcp-publisher login dns --domain ripplewatch.ai --private-key "${PRIVATE_KEY}"
cd /Users/jeremy/ripplewatch/docs/directory-listings
mcp-publisher publish
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=ripplewatch"
```

No-DNS alternative: change `name` in server.json to `io.github.jsfeit/ripplewatch`, run
`mcp-publisher login github`, enter the code it prints at github.com/login/device, then
`mcp-publisher publish`.

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
I couldn't confirm their submit flows from outside. PulseMCP reads from the official
registry, so step 1 may be enough there. Look for "Submit" or "Add server" on mcp.so and
glama.ai/mcp/servers and paste the copy above.

### 4. Anthropic Claude connectors directory (last)
Submitted from the Claude.ai organization admin area (needs a Team or Enterprise org) or
Anthropic's directory review form. Have ready: public docs, privacy policy, icon, auth
instructions and the reviewer login. It is a review request, not a guarantee.
Their FAQ: https://support.claude.com/en/articles/11596036-anthropic-mcp-directory-faq
