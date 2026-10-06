---
name: log-a-deal
description: Use when the user tells you how a deal went, such as a win or loss against a competitor, or asks to bring in their deal history from a CRM, spreadsheet or call tool. Records the outcome in their Ripplewatch account so competitor moves can be tied to real deals.
---

# Log a deal

## When to use

The user mentions a deal they won or lost, especially against a named competitor, or wants to add past deals in bulk.

## Steps

1. For one deal, call `log_win_loss` with the competitor, whether it was won or lost, and the reason in the user's own words if they gave one. If you are not sure which competitor they mean, call `list_competitors` and ask.
2. For many deals (a CSV, spreadsheet, or rows read from a connected CRM), call `import_win_loss` with one deal per line, header row first. Read the rows yourself from the tool the user has connected, and tell them what you are about to read before you read it.
3. If the user mentions a competitor coming up on a sales call and a call tool is connected, call `log_call_mentions` with only short verbatim snippets (a sentence or two), never full transcripts.
4. After logging, say what was recorded. If `log_win_loss` returns a momentum change, mention it.

## Output

Confirm each recorded deal in one line: competitor, outcome, reason. For a bulk import, report how many were added and how many were skipped.

## Boundaries

- Do not log a deal the user did not describe. Do not infer an outcome or a reason.
- Do not send full conversation history or whole call transcripts to any tool.
- Ask before importing from a connected tool, and import only closed deals.
