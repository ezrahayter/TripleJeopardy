-- Evergreen recycling: a published post can re-draft itself on an interval so
-- the operator can freshen and re-schedule it.

alter table posts
  add column if not exists evergreen_days int not null default 0,
  add column if not exists recycled_at timestamptz;
