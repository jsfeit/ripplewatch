# Cursor: ready to go once the listing is live

Status as of 2026-11-13: both Cursor Directory entries (`/plugins/ripplewatch`, `/plugins/ripplewatch-1`) are
hidden after scanner failures on Cursor's side. Added to the re-run list on cursor/community-plugins#414.
Nothing below goes out until one of them shows up at https://cursor.directory (search "Ripplewatch").

## Go-live checklist (in order)

1. Confirm the listing is public: open it logged out; the "unpublished and hidden" banner is gone and it appears in search.
2. Confirm Cursor kept one entry. If both are live, ask in #414 for the duplicate to be removed.
3. Install it from the directory in Cursor yourself and sign in (this is the one flow nobody has run end to end).
4. Add the rule: listing page, ... menu, Edit, add a component of type Rule, name `ripplewatch`,
   paste `ripplewatch.mdc` from this folder. Save. If saving triggers a new scan, wait. If it fails the scan again,
   remove the rule and wait for Cursor, don't resave repeatedly.
5. Merge the draft PR "Setup page: link the Cursor Directory listing" (already prepared, edit the slug first if Cursor kept `ripplewatch-1`).
6. Post the announcement below.
7. Check Admin > AI connections for a Cursor card moving off zero (recheck in two weeks).

## Announcement drafts

**LinkedIn / X (short):**
Ripplewatch now works in Cursor.

If you're building a product in Cursor, you can ask it who your competitors are moving against, which one is heating up, and whether their latest change is costing you deals, without leaving the editor. One click to add, sign in once.

Add it here: [Cursor Directory link] or the Add to Cursor button at https://www.ripplewatch.ai/connect/claude-and-chatgpt

**One-liner for replies and DMs:**
It's in Cursor now too: one click to add, then ask it about your competitors from the chat you already have open. [link]

## Notes

- The rule only tells Cursor when to call Ripplewatch and asks it to confirm before writing anything. It adds no new product behavior.
- Audience: founders and product people who build in Cursor. Don't expect developers to be the buyers.
