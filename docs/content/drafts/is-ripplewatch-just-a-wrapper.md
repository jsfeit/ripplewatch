---
action: new-post
slug: is-ripplewatch-just-a-wrapper
title: "Is Ripplewatch just a wrapper?"
description: "A fair question. Here's what we share with a wrapper, and what's still left when you turn the model off."
publish_date: 2026-11-17
status: draft
---

Every few weeks someone tells us Ripplewatch is just another wrapper. It's a fair thing to say about a lot of AI products, and some of what we do really does run on the same models you use. So let's take it seriously.

A wrapper, the way people use the word, is a thin layer on top of a model: a text box, a prompt, maybe a nicer font. If the model disappeared, nothing would be left. That's the standard worth holding us to.

## What the skeptics get right

The model isn't ours. We call the same kind of large language models as everyone else. We don't have a secret one, and if we said we did, you shouldn't believe us.

A chat can also do a good one-off competitor read. Ask Claude or ChatGPT about a competitor today and you'll get a solid summary in a minute. If that's all you need, use it. We wrote about [where a single prompt holds up and where it stops](/blog/why-not-just-ask-claude-or-chatgpt-to-research-your-competitors), including a free prompt you can run yourself.

And yes, you can build a version of this at home. Both assistants can run a task on a schedule. Keep a document, run a weekly prompt, have it save what it found. Some people do that, and it works for a while.

## The test: turn off the model

Here's a better way to tell a wrapper from a product. Switch the model off and see what's left.

With a wrapper, you're left with a text box. With Ripplewatch, you're left with a crawler that checks competitors' pricing pages and job boards every day, and their news, reviews, buzz and ads every week. You're left with the history of what those pages said each time we looked, your own won and lost deals and churn, a method that turns up to ten inputs into one score from -100 to +100, and the schedule that decides when to tell you something. [The method is published](/blog/momentum-score-methodology), so you can check our work.

The model does real work on top of that. It reads a press story and decides whether it's good or bad news for the competitor. It reads a pricing change and judges whether it matters to a company like yours. But the step that turns those readings into a Momentum score is arithmetic over data we stored, done the same way every time. A model improvising a score would hand you a different one each day.

If anything, it runs the other way round. In most wrappers the product is the interface and the model hides behind it. Here the assistant is the interface, and what we built is the part behind it: the data, the history and the schedule.

## What a chat can't do on its own

Three things, and they're all about time.

**It can't remember.** The most useful question in competitive intelligence is what changed, and that takes two snapshots to answer. A new chat has only today's. It can read a pricing page. It can't tell you the entry plan was cheaper in September, because nobody saved September. Ripplewatch saves it every time it looks.

**It can't watch.** Nothing happens between chats. A competitor can raise prices on Tuesday and you'll hear about it when you next think to ask, which is often when a prospect brings it up. Ripplewatch checks every day, and sends a daily alert only when something scores high for a business like yours. A quiet day gets no message.

**It can't score the same way twice.** Ask a chat who's heating up in your market on Monday and again on Friday, and the answer shifts with whichever sources it happened to find. Momentum comes from the same inputs, calculated the same way, so a move from Steady to Heating up means something happened, not that the model felt differently.

There's a fourth thing underneath those. A chat doesn't know your business unless you tell it, every time. Ripplewatch keeps your positioning, your won and lost deals and, if you sell to consumers, your churn, so each move gets read against them.

## A made-up example, week by week

Here's an invented company, to make this concrete. Brightly is a meal-planning app with a monthly subscription, and its closest competitor is Northwind. Everything below is illustrative. The names and numbers are made up.

- Week 1, with a chat alone: you ask Claude what Northwind is up to. You get a good summary of their pricing, their hiring and a recent launch. Useful, and gone by Friday.
- Week 3, with a chat alone: you ask again. The summary is fine, but it can't say whether anything changed, because it has no copy of last time's answer or last time's pricing page.
- Week 3, with Ripplewatch: Northwind's pricing page changed on August 8. Ripplewatch saw it within a day, kept both versions, and moved Northwind from Steady to Heating up.
- Week 6, with Ripplewatch: you'd told your assistant that Brightly's monthly churn went from about 4% to about 6%. Ripplewatch lines the two up and says so plainly: churn started rising around August, Northwind had a pricing change on August 8, and it's timing only, not proof of cause.

That last sentence is how the product actually words it, and the caution is deliberate. We can see that two things happened in the same month. We can't see why a customer left. The only way to find that out is to ask them, so Ripplewatch will draft a cancellation survey for you to send.

## When you shouldn't use Ripplewatch

- You need one answer, once. Use a prompt. It's free and it's good.
- You follow one or two competitors and you're happy checking them monthly. A scheduled prompt and a document will do, and you'll save the $29.
- You won't tell it anything about your deals or customers. It still watches and scores, but without your history the scoring stays general. It gets sharper as it learns what you lose and why.
- You need battlecards and a shared workspace for a sales team. Tools like Crayon and Klue are built for that, and [we compare them honestly](/compare).
- You don't use an assistant that supports MCP. Ripplewatch lives inside Claude, ChatGPT, Cursor and similar tools. If you don't use one, it isn't for you yet.

If you're still skeptical, that's reasonable, and there's a cheap way to settle it. It's $29 a month plus usage you prepay for. If it isn't useful in the first 30 days, email us and we'll refund the $29 and any balance you haven't used. Only usage you've already spent can't come back.
