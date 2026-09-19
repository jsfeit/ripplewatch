# AI-citation (GEO/AEO) checklist

What it takes for ChatGPT, Perplexity, Claude, and Google's AI Overviews to reliably cite Ripplewatch when answering a relevant question. Split into what's already done on-site (technical foundation) versus what's ongoing practice (off-page + content habits).

## Already done (verify periodically, don't re-do)
- [x] AI crawler allowlist in robots.txt (OAI-SearchBot, ChatGPT-User, PerplexityBot, Perplexity-User, Claude-User, Claude-SearchBot, GPTBot, ClaudeBot, anthropic-ai, Google-Extended, CCBot, Applebot-Extended)
- [x] llms.txt listing all live pages
- [x] Organization + WebSite JSON-LD schema sitewide
- [x] BlogPosting schema with real dateModified, BreadcrumbList, author Person schema
- [x] FAQPage schema on posts structured as Q&A
- [x] Person schema for the founder (About page) — matches the blog byline
- [x] Product/SoftwareApplication schema on /pricing
- [x] Single, distinct H1 per page (no duplicate headings across pages competing for the same query)
- [x] /compare and /alternatives pages have genuinely different content per page type, not duplicated paragraphs

## Ongoing content practices

### Answer-first structure
- [ ] Every new blog post opens with a direct 2-3 sentence answer to its own implied question before any narrative — AI answer engines quote the first clear, self-contained answer they find, not buried conclusions
- [ ] Use question-form subheadings where the content is genuinely answering a question ("What does a competitive intelligence dashboard need to track?" beats "Dashboard requirements")
- [ ] Keep factual claims (pricing, feature scope, integration list) in one canonical place (the /pricing page and FAQ) and link to it rather than restating numbers inline elsewhere — inconsistent numbers across pages is one of the fastest ways to lose citation trust

### Structured data discipline
- [ ] Every new page type gets appropriate schema before launch, not retrofitted later
- [ ] FAQPage schema only on pages with genuine, distinct Q&A content — schema on content that isn't really FAQ-shaped can read as spam to Google's structured-data guidelines

### External corroboration (the part schema can't do alone)
AI answer engines weight consistency across independent sources heavily — a claim repeated identically on the company's own site, G2, Crunchbase, and a press mention ranks higher than the same claim only on the company's own site.
- [ ] Keep company description, pricing, and category consistent across ripplewatch.ai, G2, Capterra, SaaSHub, Crunchbase (see `third-party-presence-tracker.md`)
- [ ] Earn a small number of genuine backlinks/mentions from the PR pitch and Product Hunt launch — even 3-5 independent mentions meaningfully changes how AI systems weight the brand's claims about itself

### Freshness signals
- [ ] dateModified stays accurate (already wired to real updated_at — just don't let posts go stale without ever being revisited)
- [ ] Revisit and update the /state-of-competitive-intelligence report periodically if it's meant to be cited as a living reference — a report that never updates loses citation priority to a competitor's more recent one

### What NOT to do
- Don't add fabricated statistics, customer counts, or "trusted by" claims anywhere (none currently exist in the codebase — keep it that way until real numbers exist). A fabricated stat that gets cited by an AI engine and later turns out false is far more damaging than having no stat at all.
- Don't keyword-stuff question-form headings that don't actually answer a real question — this reads as manipulation to both search engines and AI crawlers, and both are increasingly good at detecting it.
- Don't duplicate the same paragraph across multiple page types (the exact mistake fixed in /compare vs /alternatives) — distinct pages need distinct content, or AI systems (and Google) treat them as one weaker page instead of two useful ones.
