# AI visibility playbook

Written 2026-10-12. Companion to `outreach-log.md` (every page), `directory-listings.md` (paste-ready copy) and `tracking.csv` (weekly numbers).

## What the searches showed
Ripplewatch appeared in none of the results for 16 of 17 queries. The pages that rank, and that AI answers tend to draw from, fall into five kinds:

1. **Lists on vendor blogs** ("best CI tools 2026"). The author includes themselves and a few others.
2. **"Alternatives to Crayon/Klue" pages.** Small-team and low-price angles are open (Cotera, Unkover). Linkeddit already owns the self-serve slot at $99.
3. **How-to guides for pricing tracking.** They need data to cite, which your pricing study is.
4. **MCP and Claude pages and directories.** Newer and thin, so a good listing counts for a lot.
5. **Reddit threads.** The same questions keep getting asked.

Your own blog already gets cited: ChatGPT sent a visitor to `/blog/competitor-tracking-tools-under-500-a-month`. That's the content type that works for you, so more list-style posts are the cheapest lever you control.

## The targets that matter most, and how to get in

Contact paths below are not verified. Check each site for its own submission or contact route, and don't guess an email.

### 1. MCP directories (do first, about an hour total)
Targets: mcpmarket.com, mcpservers.org, Smithery, Glama, PulseMCP.
- Use the copy in `directory-listings.md`: the MCP URL, a one-line description, a short description and the tool list.
- Find the site's "submit" link or its GitHub repo's contributing guide, and follow it. Some want a public GitHub repo. If so, that needs a decision from you on publishing code, and I won't publish anything without your say.
- Why first: these pages are the sources for "competitive intelligence MCP server" queries, and the competition there is only a handful of small vendors.

### 2. GenAI Unplugged (Substack, "replaced my $150/month tool")
- The author built a Claude agent for competitor analysis, so your readers overlap exactly.
- Send a short note from you, not a pitch: say you built an MCP version of the same idea, link the setup guide, and offer them free access to try it. Don't ask for a link in the first message.

### 3. Cotera (two articles)
- Targets: the "Crayon alternative" article and the "monitor competitor prices" article.
- The first argues that small teams don't need a CI platform, which is your pitch. The second says pricing pages are the hard part, which is your study's finding.
- Send one note covering both: the study as data they can cite, plus a line that Ripplewatch fits their "$0 to $100 a month" stack.

### 4. Unkover (three articles)
- Their tools list has a "no-subscription starting point" for founders. Ask to be considered as the next step up.
- Their AI article already discusses Crayon's MCP server. A note that a $29 one exists is a news hook.

### 5. Reddit: r/SaaS pricing thread and r/claudeskills thread
- Answer the actual question first. Use the pricing study as data for the r/SaaS one and the setup guide for r/claudeskills.
- Say plainly you built Ripplewatch. Don't post two links in one answer. Check each subreddit's self-promotion rules before posting.

### 6. Your own site (highest control)
- Write list-style posts for the queries you want: "competitor tracking tools under $X," "best competitive intelligence tools for solo founders," "how to track a competitor's pricing when they don't publish it."
- Include real comparisons and be honest about where others fit better. Pages that read as neutral get cited more than ads.

### Later
- **Gartner Peer Insights profile:** worth it once you have a few real customer reviews.
- **Medium-fit lists** (Improvado, Visualping, Cirrus Insight, Sybill): ask once you have one or two placements to point to.

## How being "sourced" is tracked
There are four signals, from most to least reliable. `tracking.csv` gets a row each Wednesday from the weekly sweep.

| Signal | Source | What it tells you | Limits |
|---|---|---|---|
| **Visits from AI assistants** | Vercel Web Analytics referrers (chatgpt.com, perplexity.ai, gemini, copilot, claude.ai) | Real people who clicked a citation | Excludes claude.ai visits to `/oauth/consent`, which are connection sign-ins, not citations. Many AI answers send no referrer |
| **Pages that mention Ripplewatch** | The weekly search sweep | Whether the web is starting to include you | Counts search results, not AI answers |
| **Sample AI answers** | A browser check of Perplexity and ChatGPT with six fixed questions | Whether you appear and which sites get cited | Six questions is a small, noisy sample. It's a trend line, not a share-of-voice number |
| **Crawler visits** | Not tracked yet | Whether GPTBot, ClaudeBot and others are reading you | Needs log access. Skip for now |

## Baseline, 2026-09-12 to 2026-10-12
- AI referrals that were real citations: **3 visitors**. ChatGPT sent 2 (one to the blog post above, one to the home page) and Claude sent 1 (home page).
- claude.ai sent 5 more visitors to `/oauth/consent`. Those are sign-ins to connect Ripplewatch, likely yours or testers', not citations.
- Perplexity, Gemini and Copilot: 0.
- Pages that mention Ripplewatch among search results: 0 of about 150 results.
