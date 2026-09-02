-- Daily snapshot of each published post's metrics, so Analytics can show
-- engagement/reach as a trend instead of just the latest number.

create table metric_snapshots (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references orgs (id) on delete cascade,
  post_target_id uuid not null references post_targets (id) on delete cascade,
  captured_on    date not null default (now() at time zone 'utc')::date,
  metrics        jsonb not null default '{}',
  unique (post_target_id, captured_on)
);
create index metric_snapshots_org_idx on metric_snapshots (org_id, captured_on);

alter table metric_snapshots enable row level security;
create policy metric_snapshots_read on metric_snapshots
  for select to authenticated using (tj_is_member(org_id));
-- writes only from the worker (service role, bypasses RLS)

-- carry org_id so the worker can stamp the snapshot without another lookup
drop function if exists tj_targets_needing_metrics();
create function tj_targets_needing_metrics()
returns table (
  id uuid,
  social_account_id uuid,
  external_post_id text,
  org_id uuid
)
language sql security definer set search_path = public as $$
  select pt.id, pt.social_account_id, pt.external_post_id, p.org_id
  from post_targets pt
  join posts p on p.id = pt.post_id
  join social_accounts sa on sa.id = pt.social_account_id
  where pt.status = 'published'
    and pt.external_post_id is not null
    and sa.status = 'active'
    and pt.published_at > now() - interval '30 days'
    and (pt.metrics_synced_at is null or pt.metrics_synced_at < now() - interval '6 hours')
  order by pt.published_at desc
  limit 40;
$$;
