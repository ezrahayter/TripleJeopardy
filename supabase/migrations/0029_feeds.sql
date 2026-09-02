-- RSS/Atom → drafts. A campaign can watch feeds (its own press page, a news
-- search, ActBlue blog); the worker turns new items into draft posts.

create table if not exists campaign_feeds (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references orgs(id) on delete cascade,
  campaign_id     uuid not null references campaigns(id) on delete cascade,
  url             text not null,
  label           text,
  last_checked_at timestamptz,
  last_error      text,
  created_at      timestamptz not null default now()
);

create index if not exists campaign_feeds_campaign_idx on campaign_feeds (campaign_id);

create table if not exists feed_items_seen (
  feed_id    uuid not null references campaign_feeds(id) on delete cascade,
  guid       text not null,
  created_at timestamptz not null default now(),
  primary key (feed_id, guid)
);

alter table campaign_feeds enable row level security;
alter table feed_items_seen enable row level security;

create policy campaign_feeds_member on campaign_feeds
  for all to authenticated
  using (tj_is_member(org_id))
  with check (tj_is_member(org_id));

create policy feed_items_seen_member on feed_items_seen
  for select to authenticated
  using (exists (select 1 from campaign_feeds f where f.id = feed_id and tj_is_member(f.org_id)));
