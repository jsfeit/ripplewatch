-- The public waitlist is gone (self-serve signup replaced it); this table
-- is now a general lead-capture list (onboarding's early-email step, the
-- competitive-intel quiz, plus legacy rows from the old waitlist form), so
-- naming it "waitlist" was actively misleading. Renaming it end to end.
alter table waitlist_signups rename to leads;

-- Distinguishes where a row came from now that there's more than one
-- capture point feeding this table.
alter table leads add column if not exists capture_point text;

-- Existing draft/sent campaigns reference the old segment id by string —
-- keep them pointed at the (renamed) same audience instead of silently
-- going empty.
update email_campaigns set segment = 'leads_not_signed_up' where segment = 'waitlist_not_signed_up';
