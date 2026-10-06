# Ripplewatch ChatGPT plugin: package and submission notes

Package layout (matches OpenAI's plugin docs at developers.openai.com/plugins):

- `plugin.json`: manifest.
- `mcp.json`: points at the live MCP server, `https://www.ripplewatch.ai/api/mcp`.
- `skills/weekly-competitor-brief` and `skills/log-a-deal`: the two workflows a ChatGPT agent (including a dot) can run.

Not yet verified: OpenAI's docs don't give the exact `mcp.json` shape, so the one here uses the common `mcpServers` format. Check it when you load the plugin in ChatGPT and fix it from the error if it complains.

## Listing copy

Rules from OpenAI's guidelines: no competitor comparisons, no pricing claims, no subscription plans or upgrade prompts, no "MCP" or "Plugin" in the name.

- Display name (max 30): `Ripplewatch`
- Short description (max 30): `Competitor answers in ChatGPT` (29 characters)
- Category: Research
- Long description (max 4,000):

> Ripplewatch watches your competitors' pricing, hiring, press and product changes, and scores each one against your own positioning and your win/loss history, so you hear about the moves that matter to your business and skip the rest.
>
> With this plugin you can:
> - Ask what changed with your competitors this week and what it means for your deals.
> - See which competitors are heating up, holding steady or cooling off.
> - Ask free-form questions, like whether a competitor's new pricing is worth responding to.
> - Tell ChatGPT how a deal went, and Ripplewatch ties competitor moves to your real wins and losses.
> - Bring in deal history in bulk from a spreadsheet or a CRM that ChatGPT can already reach.
>
> Limits: Ripplewatch reads public information about the competitors you choose and what you tell it. It cannot see private competitor data. You approve the connection when you sign in, can disconnect at any time, and the plugin cannot change billing or team settings. Requires a Ripplewatch Connect account.

- Website: https://www.ripplewatch.ai
- Support: https://www.ripplewatch.ai/faq (or hello@ripplewatch.ai)
- Privacy policy: https://www.ripplewatch.ai/privacy
- Terms: https://www.ripplewatch.ai/terms

## Test cases to submit

Positive (each needs the expected tool and outcome):

1. "What changed with my competitors this week?" Expected: `get_briefing`. Outcome: a short briefing led by the most relevant change.
2. "Is Acme's new pricing something we should respond to?" Expected: `ask`. Outcome: an answer scored against the account's positioning, naming Acme.
3. "Which competitor is heating up fastest?" Expected: `get_momentum`. Outcome: competitors listed as Heating up, Steady, Cooling or Gone quiet.
4. "We lost a deal to Acme last week because they were cheaper. Log it." Expected: `log_win_loss`. Outcome: one-line confirmation of competitor, outcome and reason.
5. "Here are our closed-lost deals from the CSV: ..." Expected: `import_win_loss`. Outcome: count added and skipped.

Negative (shows appropriate refusal or fallback):

1. "Cancel my subscription and change my plan." Expected: no tool call. Outcome: says it can't change billing and points to Ripplewatch settings.
2. "What is Globex doing?" where Globex isn't tracked. Expected: `list_competitors`, then offer to add. Outcome: asks before calling `add_competitor`, never adds silently.
3. "Log all the deals you think we probably lost." Expected: no tool call. Outcome: declines to invent deals and asks for real ones.

## Demo video outline (about 2 minutes)

Sign in through the connection screen, ask for the weekly briefing, ask one free-form question, log one lost deal, show the momentum change, then disconnect the plugin.

## Checks against OpenAI's guidelines

- Tool annotations: every tool in `src/lib/mcp-tools.ts` sets `readOnlyHint`, `destructiveHint` and `openWorldHint` explicitly. Done.
- No subscription promotion: tool output should not show plans or upgrades. One message to review: `import_win_loss` says "Add funds in Settings" when the usage balance is too low (`src/lib/mcp-tools.ts`, near line 479). It reports the state of an existing account and doesn't sell anything, but a reviewer could read it as promotion. Reword it to "Your usage balance is too low right now" if it gets flagged.
- Minimum data: `log_call_mentions` takes short verbatim snippets only, and the skills tell the model never to send full conversations or transcripts.
- Authorization on every request: the MCP route verifies the token and resolves the account on each call.

## What only you can do

- Complete individual or business verification in your OpenAI organization settings. Organization owners can submit.
- Upload a square logo, at least 48 by 48 pixels.
- Give OpenAI a demo account login and password with sample data. Create a dedicated one, not your own.
- Record the demo video.

## Open risk: sign-in

ChatGPT prefers to identify itself with a client metadata URL (CIMD). Supabase rejects that format, so Ripplewatch can only work if ChatGPT falls back to dynamic client registration, which our server supports. Test this in ChatGPT before submitting. If sign-in fails, the fix is a small OAuth layer in front of Supabase that accepts ChatGPT's client URL.
