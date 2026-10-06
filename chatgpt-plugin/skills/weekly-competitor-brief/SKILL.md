---
name: weekly-competitor-brief
description: Use when the user asks what changed with their competitors, wants a weekly or recurring competitor briefing, asks whether a competitor's move matters to them, or asks which competitor is heating up. Reads from the user's Ripplewatch account.
---

# Weekly competitor brief

## When to use

The user wants to know what changed with the competitors they track and whether it matters to their business. Also use it on a schedule if the user has asked for a recurring brief.

## Steps

1. Call `start_here` first if this is a new conversation or the user seems new to Ripplewatch. Follow what it says about setup before going further.
2. Call `get_briefing` for the weekly verdict, which competitors are heating up or cooling, and the highest-relevance recent signals.
3. If the user asks about one competitor, call `get_competitor` for its momentum drivers and recent signals. For a free-form question ("should we respond to their new pricing?"), call `ask` instead.
4. Call `get_next_step` once at the end and pass the suggestion on to the user as the one thing that would make future briefs sharper.

## Output

Lead with the single most important change and why it matters for this user's positioning. Then list the other signals worth attention, most relevant first. Keep it short enough to read in a minute. Name the competitor and the date for every signal.

## Boundaries

- Only report what Ripplewatch returns. Do not guess at competitor activity it did not surface.
- If the briefing is empty or the account has no competitors yet, say so and offer to add one with `add_competitor`. Ask before adding.
- Do not describe or promote plans or pricing. If a tool reports that usage is paused, tell the user plainly and point them to their Ripplewatch settings.
