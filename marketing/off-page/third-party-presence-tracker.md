# Third-party presence tracker

Track claimed/unclaimed listings across review sites and directories relevant to a competitive-intelligence SaaS. Update the Status column as you go. "Why it matters" notes which are worth prioritizing first.

| Site | Category fit | Status | Why it matters |
|---|---|---|---|
| G2 | Competitive Intelligence, Market Intelligence | **Claimed** | Highest-traffic B2B software review site; AI answer engines (ChatGPT, Perplexity) cite G2 category pages heavily for "best X tool" queries |
| Capterra | Competitive Intelligence Software | Not started | Gartner-owned, strong SEO presence, common comparison-shopping destination |
| SaaSHub | — | **Not a fit** — Shopify-app-only, not a general SaaS directory | Skip; was assumed to be general-purpose when drafted, turned out to be Shopify App Store-specific |
| AlternativeTo | — | **Submitted** (pending community review) | Frequently indexed by AI assistants for "alternative to X" queries; free to claim |
| GetApp (Gartner network) | Competitive Intelligence | Not started | Same underlying data as Capterra in some cases; low effort once Capterra listing exists |
| SourceForge | Business Software | Optional | Lower priority — mostly open-source-adjacent audience, less B2B SaaS buyer traffic |
| Crozdesk | Competitive Intelligence | Optional | Smaller but free, low effort |
| Product Hunt | Marketing / Sales / AI | Planned (see launch kit) | One-time launch spike, but the permanent listing page persists as a backlink + review surface |
| BetaList / EarlyShark (if still pre-launch anywhere) | — | N/A | Only relevant pre-launch; skip if already live |
| LinkedIn Company Page | — | Verify exists | Check it links to ripplewatch.ai, has the About page bio content, and posts are cross-posted from the personal profile launch series |
| Crunchbase | — | Not started | Free profile; low effort, frequently cited by AI tools for company facts (founding info, funding status — mark "self-funded/bootstrapped" or whatever's accurate rather than leaving blank) |
| Wikipedia | — | Skip for now | Not viable pre-notability; revisit only after real press coverage or a Wikipedia-notable milestone |

## Claiming checklist (per site)
- [ ] Company name, tagline, and description match the approved copy in `g2-capterra-saashub-listings.md` (don't let each site drift into its own inconsistent wording — AI answer engines cross-reference multiple sources, and inconsistency reads as lower-confidence)
- [ ] Logo uploaded (same asset used in `/opengraph-image`)
- [ ] Pricing listed accurately and kept in sync when tiers change
- [ ] Categories match across all sites (Competitive Intelligence as the primary category everywhere)
- [ ] Link back to ripplewatch.ai (not a UTM-mangled URL that could break if the tracking param changes)
- [ ] Founder/team info matches the About page

## After claiming: review generation
G2 and Capterra both reward (and rank higher) listings with real reviews. Once there are paying customers:
- Ask directly, post-onboarding, for 2-3 customers willing to leave a review (G2 has an official "review generation" partner program if volume ever justifies it)
- Never incentivize reviews with anything tied to the review's content (both platforms explicitly prohibit this and will remove reviews/listings)
