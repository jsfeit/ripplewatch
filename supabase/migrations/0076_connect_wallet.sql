-- Ripplewatch Connect: a standalone, prepaid product. The customer pays a
-- monthly platform fee (a normal Stripe subscription) and funds a wallet that
-- usage draws down. Credits are only added after a payment succeeds and usage
-- is refused at a zero balance, so there is never usage on credit.
--
-- The wallet lives here (not in Stripe) because Stripe Billing has no
-- prepaid-with-auto-reload primitive: its billing credits apply at invoice
-- time, so a customer can spend past a balance and be billed afterward. Stripe
-- still collects every payment; this ledger records what was bought and used.

-- 'connect' is an account tier alongside starter and plus: a Connect account
-- has no dashboard plan, just the platform fee and the wallet.
alter table accounts drop constraint if exists accounts_tier_check;
alter table accounts
  add constraint accounts_tier_check
  check (tier in ('starter', 'plus', 'connect'));

-- Amounts are stored in micro-dollars (millionths of a dollar): a single
-- answer can cost a fraction of a cent, which whole cents would round away.
create table if not exists connect_wallets (
  account_id uuid primary key references accounts (id) on delete cascade,
  balance_micros bigint not null default 0,
  -- Auto-reload: when the balance falls below the threshold, charge the saved
  -- card for the reload amount. Minimum reload is $50 (enforced in the app).
  auto_reload_enabled boolean not null default true,
  reload_amount_cents integer not null default 5000 check (reload_amount_cents >= 5000),
  reload_threshold_cents integer not null default 1000 check (reload_threshold_cents >= 0),
  -- Set when an auto-reload payment fails; auto-reload stays off until the
  -- customer fixes their card and re-enables it, rather than retrying forever.
  reload_failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists connect_wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  kind text not null check (kind in ('funding', 'usage', 'refund', 'adjustment')),
  -- Positive adds credit, negative uses it.
  amount_micros bigint not null,
  balance_after_micros bigint not null,
  -- Idempotency key, unique per account: a Stripe invoice id for funding, a
  -- tool-call id or day key for usage. Applying the same ref twice is a no-op,
  -- so a retried webhook or cron can't double-credit or double-charge.
  ref text not null,
  description text,
  meta jsonb,
  created_at timestamptz not null default now(),
  unique (account_id, ref)
);

create index if not exists connect_wallet_ledger_account_idx
  on connect_wallet_ledger (account_id, created_at desc);

alter table connect_wallets enable row level security;
alter table connect_wallet_ledger enable row level security;

-- Customers can read their own balance and history. Nothing writes through
-- RLS: every change goes through connect_wallet_apply below, run with the
-- service role.
create policy "users can read their own wallet"
  on connect_wallets for select
  to authenticated
  using (account_id = auth_account_id());

create policy "users can read their own wallet ledger"
  on connect_wallet_ledger for select
  to authenticated
  using (account_id = auth_account_id());

-- The one way the balance changes. Atomic and idempotent:
--   * serialized per account with an advisory lock, so two concurrent calls
--     can't both pass a balance check;
--   * a ref that's already in the ledger is a no-op (applied = false);
--   * a debit that would take the balance below zero is refused unless
--     p_allow_negative is set (used only for the small overrun of a call that
--     already ran, which the caller bounds with a minimum-balance check).
create or replace function connect_wallet_apply(
  p_account_id uuid,
  p_amount_micros bigint,
  p_kind text,
  p_ref text,
  p_description text default null,
  p_meta jsonb default null,
  p_allow_negative boolean default false
)
returns table (applied boolean, balance_micros bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  perform pg_advisory_xact_lock(hashtext('connect_wallet:' || p_account_id::text));

  insert into connect_wallets (account_id) values (p_account_id) on conflict (account_id) do nothing;

  if exists (select 1 from connect_wallet_ledger l where l.account_id = p_account_id and l.ref = p_ref) then
    select w.balance_micros into v_balance from connect_wallets w where w.account_id = p_account_id;
    return query select false, v_balance;
    return;
  end if;

  select w.balance_micros into v_balance from connect_wallets w where w.account_id = p_account_id;

  if p_amount_micros < 0 and not p_allow_negative and v_balance + p_amount_micros < 0 then
    return query select false, v_balance;
    return;
  end if;

  v_balance := v_balance + p_amount_micros;

  update connect_wallets w
     set balance_micros = v_balance, updated_at = now()
   where w.account_id = p_account_id;

  insert into connect_wallet_ledger (account_id, kind, amount_micros, balance_after_micros, ref, description, meta)
  values (p_account_id, p_kind, p_amount_micros, v_balance, p_ref, p_description, p_meta);

  return query select true, v_balance;
end;
$$;

revoke all on function connect_wallet_apply(uuid, bigint, text, text, text, jsonb, boolean) from public;
revoke all on function connect_wallet_apply(uuid, bigint, text, text, text, jsonb, boolean) from anon, authenticated;
grant execute on function connect_wallet_apply(uuid, bigint, text, text, text, jsonb, boolean) to service_role;
