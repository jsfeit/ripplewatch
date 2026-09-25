-- Auto-reload needs one thing the base wallet (0076) doesn't have: a way to
-- make sure only ONE reload charge starts when several calls notice a low
-- balance at the same moment. connect_wallet_claim_reload is an atomic claim:
-- it returns true to exactly one caller, only when a reload is actually due,
-- and holds the claim for a few minutes so a slow or crashed attempt doesn't
-- block the wallet forever.

alter table connect_wallets add column if not exists reload_started_at timestamptz;

create or replace function connect_wallet_claim_reload(p_account_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed uuid;
begin
  update connect_wallets w
     set reload_started_at = now()
   where w.account_id = p_account_id
     and w.auto_reload_enabled
     and w.reload_failed_at is null
     -- balance is in micro-dollars, the threshold in cents (1 cent = 10,000 micros)
     and w.balance_micros < (w.reload_threshold_cents::bigint * 10000)
     and (w.reload_started_at is null or w.reload_started_at < now() - interval '5 minutes')
  returning w.account_id into v_claimed;

  return v_claimed is not null;
end;
$$;

revoke all on function connect_wallet_claim_reload(uuid) from public;
revoke all on function connect_wallet_claim_reload(uuid) from anon, authenticated;
grant execute on function connect_wallet_claim_reload(uuid) to service_role;
