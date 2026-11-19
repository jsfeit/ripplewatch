# Relaunch campaign: unsent leads, control vs. test (3-step chains)

Draft v2 for review (revised after feedback: no "I built", subjects say "inside Claude or ChatGPT", bigger pitch than a pricing-page check). Nothing here is in Instantly yet.

Setup: one new campaign, two variants (A and B) on every step, so each lead gets one consistent chain. Same footer as the other campaigns (postal address and opt-out line), link tracking off, about 15 sends a day, steps spaced 3 days then 4 days. Variables: `{{firstName}}`, `{{companyName}}`, `{{Icebreaker}}` (leads with no icebreaker just skip that line).

The one thing being tested: does asking for a reply (A) beat showing the product in the AI they already use, with a free try link (B)? Offer, price and sign-off are the same in both.

Facts used, all from the site: $29 a month plus usage you prepay for, works inside Claude or ChatGPT, one Momentum score per competitor, free competitor read with no signup.

---

## Variant A (control): reply and we'll run it for you

**Step 1** (no link)

Subject: `{{companyName}} competitors, inside Claude or ChatGPT`

```
Hey {{firstName}},

{{Icebreaker}}

Ripplewatch is a competitive analyst that lives inside Claude or ChatGPT. It watches your competitors' hiring, pricing, launches, press and reviews, checks all of it against your own won and lost deals, and tells you who's gaining on you and what to do about it.

Reply with the competitor that worries you most and we'll run it and send you the read. No signup, no call.

Jeremy
```

**Step 2** (3 days later, no link)

Subject: `Re: {{companyName}} competitors, inside Claude or ChatGPT`

```
{{firstName}}, quick follow-up.

The part teams like is the Momentum score: one number from -100 to +100 per competitor, so you can see who's heating up and who's gone quiet without reading a single pricing page. And since it knows why you win and lose, it can say which move actually threatens {{companyName}}.

It's $29 a month plus usage you prepay for, and there's nothing new to open because you just ask it in Claude or ChatGPT.

Send us one competitor and we'll show you what it finds.

Jeremy
```

**Step 3** (4 days later, no link)

Subject: `Should I close this out?`

```
{{firstName}}, I'll stop here so I'm not clogging your inbox.

If a competitor ever catches your team off guard in a deal, reply with their name and we'll send a read the same day.

Jeremy
```

---

## Variant B (test): lives in your AI, try it free

**Step 1** (one link)

Subject: `Your competitors, inside Claude or ChatGPT`

```
Hey {{firstName}},

{{Icebreaker}}

Ripplewatch turns Claude or ChatGPT into your competitive analyst. Ask "Is Northlane heating up?" and it answers from their hiring, pricing, launches, press and reviews, scored against your own won and lost deals. No dashboard, no new tab.

Try a free read on one competitor, about a minute, no signup:
https://www.ripplewatch.ai/onboarding?path=connect&utm_source=instantly&utm_medium=email&utm_campaign=relaunch-b&utm_content=b-step1

Jeremy
```

**Step 2** (3 days later, one link)

Subject: `Re: Your competitors, inside Claude or ChatGPT`

```
{{firstName}}, here's what's behind the answer.

Every competitor gets a Momentum score from -100 to +100, built from ten inputs: hiring, pricing, product changes, press and funding, win rate against you, reviews, buzz and more. Below -15 is cooling, above +15 is heating up, and it tells you which inputs are driving it.

It also gets sharper the more you tell it. Say "we lost Acme to Northlane on price" and every answer after that knows. $29 a month plus usage you prepay for.

Free read, no signup:
https://www.ripplewatch.ai/onboarding?path=connect&utm_source=instantly&utm_medium=email&utm_campaign=relaunch-b&utm_content=b-step2

Jeremy
```

**Step 3** (4 days later, one link)

Subject: `Last note`

```
{{firstName}}, last one from us.

If tracking competitors isn't on your list right now, no problem. If it is, the free read takes about a minute:
https://www.ripplewatch.ai/onboarding?path=connect&utm_source=instantly&utm_medium=email&utm_campaign=relaunch-b&utm_content=b-step3

Jeremy
```

---

## What to watch

Replies that name a competitor (A) against clicks that turn into free reads (B). Check the Live reads admin page for reads that came from the `relaunch-b` UTM. At 15 a day, split two ways, expect directional reads only after a couple of weeks.
