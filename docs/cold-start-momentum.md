# Solving the Momentum cold start

Momentum compares the last 30 days with the 30 before. A competitor added today has no "before", so for about a month the honest answer is "not enough history yet". That is true and useless. This note lists every way to close the gap, what each costs, and what we measured on a real account (Tilt, 5 competitors, 2026-11-18).

## What we measured (live endpoints, real competitors)

| Source | Dated history available on day one? | Evidence |
|---|---|---|
| Open roles, Greenhouse / Lever / Ashby | Yes. Every open role carries its posted date. | 76 Upstart roles: 20 posted in the last 30 days, 16 in the 30 before. Lever and Ashby return `createdAt` / `publishedAt` on every role. |
| News and funding | Yes, with date-bounded queries (`after:` / `before:`). | Upstart 32 results last 30 days, 28 the 30 before. EarnIn 100 vs 24. Today's first check never asks per window, so our prior window is empty. |
| Buzz (Hacker News) | Yes. Algolia filters by `created_at_i`. | Upstart 1,218 mentions last 30 days vs 523 prior. Brigit 572 vs 536. |
| GitHub commits | Yes. `stats/commit_activity` returns 52 weeks. | Already fetched; only the last 4 weeks are used. |
| Pricing page | Partly. Wayback snapshots exist for large sites. | upstart.com and earnin.com have snapshots near 30/60/90 days ago; brigit.com/pricing has none. |
| Review ratings | Partly. App Store review feeds are dated; G2/Capterra are not reliably. | Not spiked yet. |
| Ads (Meta Ad Library) | Yes in principle (ad start dates), needs a token. | Not spiked. |
| Our own first-check signals | No. Everything lands "this month". | Upstart 10 signals in 0-30 days, 0 in 30-60. A trend from this would call every competitor "surging". |

Caveat on hiring: posted dates only cover roles still open, so older windows are undercounted (survivorship). It is good for "are they hiring faster", not for exact headcount history.

## Options, best first

1. **Backfill dated sources on add (recommended).** On a competitor's first check, run hiring, news, buzz and GitHub for the prior 60 days and write the results with their true dates, so the prior window is populated immediately. Real Momentum within minutes, labeled "early read" (confidence low) until a full month of our own crawling confirms it. Cost: collector changes per source; news and HN need a date-bounded query; no new vendors.
2. **Watch priority (built, this PR).** A 0-100 rank from relevance-weighted findings, lost deals, size/presence versus peers and breadth. Needs no history. Answers "who deserves attention now", not "who is moving".
3. **Pricing history from Wayback.** Fetch snapshots near 30 and 60 days ago, diff against today's page, emit pricing signals dated at the snapshot. Works only where snapshots exist; say so when they do not.
4. **Peer benchmark.** Compare a competitor with the others in its category (hiring size, buzz, rating percentile). Part of priority already; could become a standalone "versus category" line.
5. **Deals as the shortcut.** One lost deal against a competitor beats a month of signals. Priority weights it most. Importing from a CRM or call recorder on day one is the single biggest accuracy lever; the assistant already asks for it.
6. **Seed from an LLM research brief.** A one-time written summary of what each competitor has been doing, clearly labeled as a brief and not a measured trend. Cheap, useful for the narrative, but must never be scored as Momentum.
7. **Wait.** What we do now. Honest and nearly empty.

## What not to do

- Do not compute a trend from the first check's signals. They are all dated "recently" because they were just discovered.
- Do not show a Momentum number from fewer than two windows of data without an "early read" label.
- Do not ask an LLM to guess direction from general knowledge.

## Proposed order

Backfill (1) for hiring, news and buzz first, since all three were proven above, then GitHub, then pricing history (3).
