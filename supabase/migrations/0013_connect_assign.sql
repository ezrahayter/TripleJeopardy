-- Triple Jeopardy — assign connected Pages to campaigns after the OAuth grant.
--
-- Before: connecting Facebook from campaign A attached *every* Page the operator
-- manages to campaign A. Wrong for an agency running many candidates. Now the
-- Meta round-trip lands in a staging row; the operator assigns each Page/IG to a
-- campaign (or skips it) on the Accounts page, and only the chosen ones become
-- social_accounts.

-- Meta connect is org-level now — the campaign is chosen after authorizing.
-- (Threads still carries a campaign_id through; it returns a single account.)
alter table oauth_states alter column campaign_id drop not null;

create table pending_connections (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references orgs (id) on delete cascade,
  user_id            uuid not null references auth.users (id) on delete cascade,
  provider           text not null check (provider in ('meta', 'threads')),
  -- [{ network, external_id, handle, meta, token_ciphertext }]
  -- token_ciphertext is AES-256-GCM (server-only key) — safe to be RLS-readable,
  -- same as social_accounts.secret_ciphertext.
  assets             jsonb not null default '[]',
  refresh_ciphertext text,                 -- long-lived user token (Meta)
  token_expires_at   timestamptz,
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null default now() + interval '30 minutes'
);
create index pending_connections_user_idx on pending_connections (user_id);

alter table pending_connections enable row level security;
-- the operator who started the connect reads their own staging row to render the
-- picker; all writes go through the Edge Functions (service role).
create policy pending_connections_own on pending_connections
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy pending_connections_own_delete on pending_connections
  for delete to authenticated
  using (user_id = (select auth.uid()));
