-- Lets account members rate their own account's signals (thumbs up/down,
-- reusing the existing correct/incorrect label used by the admin eval UI —
-- a customer's live judgment on whether a signal was actually relevant is
-- exactly the same kind of ground truth, just from a much larger and more
-- representative population than an admin manually labeling examples).
-- Previously this table was admin-only (service-role client, no policies).
create policy "users can rate their account's signals"
  on signal_eval_labels for all
  to authenticated
  using (
    signal_id in (
      select s.id from signals s
      join competitors c on c.id = s.competitor_id
      where c.account_id = auth_account_id()
    )
  )
  with check (
    signal_id in (
      select s.id from signals s
      join competitors c on c.id = s.competitor_id
      where c.account_id = auth_account_id()
    )
  );
