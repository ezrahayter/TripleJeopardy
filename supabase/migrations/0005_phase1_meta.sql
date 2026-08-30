-- Triple Jeopardy - Phase 1: Facebook, Instagram, Threads (Meta family).
-- Run after 0001-0004. Adds OAuth networks, token columns, and the oauth_states
-- table used by the connect flow.

-- ── widen the network enum ─────────────────────────────────────────
alter table social_accounts drop constraint social_accounts_network_check;
alter table social_accounts add constraint social_accounts_network_check
  check (network in ('bluesky', 'facebook', 'instagram', 'threads'));

-- ── token fields for OAuth networks ────────────────────────────────
alter table social_accounts add column token_expires_at timestamptz;
-- long-lived user/refresh token, kept to re-derive or refresh the publish token
alter table social_accounts add column refresh_ciphertext text;
-- display extras: { page_name, ig_username, threads_username, ... }
alter table social_accounts add column meta jsonb not null default '{}';

-- reconnecting the same asset updates the row instead of duplicating it
alter table social_accounts
  add constraint social_accounts_campaign_network_external_key
  unique (campaign_id, network, external_id);

-- ── OAuth handshake state (CSRF nonce -> who/where) ────────────────
create table oauth_states (
  state       text primary key,
  provider    text not null check (provider in ('meta', 'threads')),
  org_id      uuid not null references orgs (id) on delete cascade,
  campaign_id uuid not null references campaigns (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  redirect_to text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '15 minutes'
);

alter table oauth_states enable row level security;
-- no policies: only the Edge Functions (service role) ever touch this table.

-- ── token-refresh queue helper ────────────────────────────────────
-- The worker calls this each sweep to find Meta accounts whose token is within
-- 7 days of expiry (or already past).
create or replace function tj_accounts_needing_refresh()
returns setof social_accounts
language sql security definer set search_path = public as $$
  select *
  from social_accounts
  where network in ('facebook', 'instagram', 'threads')
    and status = 'active'
    and token_expires_at is not null
    and token_expires_at < now() + interval '7 days'
  order by token_expires_at;
$$;
