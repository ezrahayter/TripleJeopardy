-- Per-post engagement/reach, synced from each network into the target row.
-- Normalized keys across networks: likes, comments, shares, reposts, replies,
-- quotes, reach, impressions, views, saves — only what the network reports.

alter table post_targets add column metrics jsonb not null default '{}';
alter table post_targets add column metrics_synced_at timestamptz;

-- What the worker's metrics step should refresh: published targets with a known
-- external id, on an active account, published within the last 30 days, not
-- synced in the last 6 hours. Engagement front-loads in the first day or two,
-- so 6h × ~5 checks/day is plenty and 30 days stops us polling forever.
create or replace function tj_targets_needing_metrics()
returns table (
  id uuid,
  social_account_id uuid,
  external_post_id text
)
language sql security definer set search_path = public as $$
  select pt.id, pt.social_account_id, pt.external_post_id
  from post_targets pt
  join social_accounts sa on sa.id = pt.social_account_id
  where pt.status = 'published'
    and pt.external_post_id is not null
    and sa.status = 'active'
    and pt.published_at > now() - interval '30 days'
    and (pt.metrics_synced_at is null or pt.metrics_synced_at < now() - interval '6 hours')
  order by pt.published_at desc
  limit 40;
$$;
