-- Also retry Meta accounts that errored on a previous refresh. Without this an
-- account that hit a transient failure (network blip, brief Meta 5xx) goes to
-- status='error' and never self-heals until someone reconnects. The 15-minute
-- sweep cadence is slow enough that re-attempting errored ones is harmless.
create or replace function tj_accounts_needing_refresh()
returns setof social_accounts
language sql security definer set search_path = public as $$
  select *
  from social_accounts
  where network in ('facebook', 'instagram', 'threads')
    and status in ('active', 'error')
    and token_expires_at is not null
    and token_expires_at < now() + interval '7 days'
  order by token_expires_at;
$$;
