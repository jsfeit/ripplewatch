# Outreach: UTM links, variant C, and more sending capacity

Written 2026-10-15. Nothing here has been changed in Instantly. It is all for you to apply.

## 1. UTM links (so you can see which email or post a visit came from)

Why: 199 of about 219 visitors in the last two weeks arrived with no referrer, so there is no way to tell what drove them.

Use one pattern everywhere: `utm_source` is where it was posted, `utm_medium` is the channel, `utm_campaign` names the campaign, and `utm_content` says which email.

| Where | Link to paste |
|---|---|
| MCP angle test, variant A, step 3 (snapshot link) | https://www.ripplewatch.ai/competitor-snapshot?utm_source=instantly&utm_medium=email&utm_campaign=mcp-ab-test&utm_content=a-step3 |
| Offer test B campaign, any link to the site | https://www.ripplewatch.ai/competitor-snapshot?utm_source=instantly&utm_medium=email&utm_campaign=offer-test-b |
| Early-stage founders campaign, any link to the site | https://www.ripplewatch.ai/competitor-snapshot?utm_source=instantly&utm_medium=email&utm_campaign=early-stage-founders |
| Variant C, step 2 and 3 (the free read) | https://www.ripplewatch.ai/onboarding?path=connect&utm_source=instantly&utm_medium=email&utm_campaign=mcp-c&utm_content=c-step2 |
| LinkedIn post about the pricing study | https://www.ripplewatch.ai/blog/early-stage-saas-pricing-pages-study?utm_source=linkedin&utm_medium=social&utm_campaign=pricing-study |

Rules:
- Add the tags only where a link already exists. Don't add a new link to step 1 of a cold email.
- Keep link tracking in Instantly **off**. These tags are separate from it and don't touch deliverability.
- Change `utm_campaign` and `utm_content` per campaign and step so you can tell them apart.

What happens when someone clicks:
- The site saves the tags in their browser.
- Lead forms (the snapshot, the quiz, the email capture) already save them onto the lead, so they show on the lead record.
- The Connect signup now saves them on the user too (in this PR). Where that lands is a user field in Supabase. Showing it in the new signup alert emails comes with the alert-email PR (#142) once that merges.
- Vercel's own UTM breakdown needs a paid plan, so use the lead records or Google Analytics for that.

## 2. Variant C: the free read as the offer

Idea: both current variants ask for a reply. The site now has something you can try in a minute, with no signup: a real read on one competitor, written against what you sell. This variant asks for the reply in step 1, then offers the self-serve version in step 2.

Use the same footer (postal address and opt-out line) as variants A and B. Voice is plain: no em dashes, no hype.

**Step 1** (no link)

Subject: `{{companyName}} and competitors`

```
Hey {{firstName}},

{{Icebreaker}}

I built Ripplewatch, a competitive analyst that lives inside Claude or ChatGPT. You tell it what you sell and who you're up against, and it reads their pricing page, job board and recent news, then tells you what it means for your deals.

If you reply with the competitor you worry about most, I'll run it and send you the read. No signup.

Jeremy
```

**Step 2** (3 days later, with the link)

```
Hey {{firstName}},

In case it's easier to try yourself: there's a free read on one competitor, no signup, about a minute.

https://www.ripplewatch.ai/onboarding?path=connect&utm_source=instantly&utm_medium=email&utm_campaign=mcp-c&utm_content=c-step2

It says what their pricing and hiring likely mean for {{companyName}}, and what to ask your own lost deals. If it isn't useful, tell me why and I'll stop.

Jeremy
```

**Step 3** (4 days later)

```
{{firstName}}, last note from me.

If tracking competitors isn't on your list right now, no problem. If it is, the free read is here:

https://www.ripplewatch.ai/onboarding?path=connect&utm_source=instantly&utm_medium=email&utm_campaign=mcp-c&utm_content=c-step3

Jeremy
```

How to run it: I'd **not** add C to the live A/B campaign. At 15 sends a day, three variants would each get about 5 a day, so none would read for weeks. Run C as its own campaign on the next batch of leads (about 1,375 are left) once there is more sending capacity (section 3). If you'd rather add it now, add it as a third variant on each step; only leads not yet sent step 1 would be split three ways.

What to look for (small numbers only show direction): replies that name a competitor, and clicks that turn into free reads. Check the Live reads admin page for reads run from the UTM link.

## 3. More sending capacity

Where you are: one mailbox, `jeremy@tryripplewatch.com`, capped at 30 a day and shared by three campaigns. 30 emails went out in the first six days of the new campaign, against about 90 planned.

What would fix it: more mailboxes. Three mailboxes cover the first step to 220 leads in about 3 days.

A reasonable setup:
1. **2 or 3 more sending domains**, separate from `ripplewatch.ai`. Keep your real domain (used for the product's own email) out of cold sending. Availability of any name is unchecked; use names that clearly read as Ripplewatch.
2. **Two mailboxes per domain**, about 4 to 6 in total.
3. **DNS on each domain**: SPF, DKIM and DMARC, and point the domain at `www.ripplewatch.ai` so a curious recipient lands on the real site.
4. **Warm-up in Instantly for 2 to 3 weeks** before real sends, then ramp from about 5 a day up to 15 to 20 a day per mailbox.
5. **Keep each mailbox well under 30 a day.** More domains beat more volume per mailbox.

Lead time is the catch: warm-up takes weeks, so ordering this week means real capacity in early November. Check each provider's current pricing and Instantly's in-app mailbox options before buying; I haven't checked either.

I can't buy domains or create mailboxes. When you've added them, I can update the Monday health check to cover them.
