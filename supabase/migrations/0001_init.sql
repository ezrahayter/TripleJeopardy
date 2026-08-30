-- Triple Jeopardy - Phase 0 schema
-- Tenancy: every row carries org_id (and campaign_id where it applies) from day one.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tenancy & people
-- ---------------------------------------------------------------------------
create table orgs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table memberships (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'owner'
             check (role in ('owner', 'editor', 'contributor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table campaigns (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs (id) on delete cascade,
  name          text not null,          -- candidate / race name
  office        text,
  jurisdiction  text,
  election_date date,
  timezone      text not null default 'America/New_York',
  created_at    timestamptz not null default now()
);
create index campaigns_org_idx on campaigns (org_id);

create table campaign_people (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  name        text not null,
  email       text,
  review_role text not null default 'viewer'
              check (review_role in ('candidate', 'manager', 'comms', 'approver', 'viewer')),
  created_at  timestamptz not null default now()
);
create index campaign_people_campaign_idx on campaign_people (campaign_id);

-- ---------------------------------------------------------------------------
-- Connected accounts
-- ---------------------------------------------------------------------------
create table social_accounts (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references orgs (id) on delete cascade,
  campaign_id       uuid not null references campaigns (id) on delete cascade,
  network           text not null check (network in ('bluesky')),
  account_type      text not null default 'official'
                    check (account_type in ('official', 'personal', 'surrogate')),
  handle            text not null,
  external_id       text,                       -- DID for Bluesky
  service_url       text not null default 'https://bsky.social',
  -- AES-256-GCM ciphertext of the app password. Phase 1: move to Supabase Vault
  -- or a no-select secrets table; only the worker + connect function hold the key.
  secret_ciphertext text,
  status            text not null default 'active'
                    check (status in ('active', 'error', 'revoked')),
  created_at        timestamptz not null default now()
);
create index social_accounts_campaign_idx on social_accounts (campaign_id);

-- ---------------------------------------------------------------------------
-- Posts, media, targets
-- ---------------------------------------------------------------------------
create table posts (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs (id) on delete cascade,
  campaign_id  uuid not null references campaigns (id) on delete cascade,
  body         text not null default '',
  status       text not null default 'draft'
               check (status in ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  scheduled_at timestamptz,
  created_by   uuid references auth.users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index posts_campaign_idx on posts (campaign_id);
create index posts_status_idx on posts (status);

create table post_media (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references posts (id) on delete cascade,
  storage_path text not null,          -- object key in the private 'media' bucket
  alt_text     text not null default '',
  sort         int not null default 0
);
create index post_media_post_idx on post_media (post_id);

create table post_targets (
  id               uuid primary key default gen_random_uuid(),
  post_id          uuid not null references posts (id) on delete cascade,
  social_account_id uuid not null references social_accounts (id) on delete cascade,
  status           text not null default 'pending'
                   check (status in ('pending', 'publishing', 'published', 'failed')),
  external_post_id text,               -- at:// uri
  external_url     text,
  error            text,
  published_at     timestamptz,
  unique (post_id, social_account_id)
);
create index post_targets_post_idx on post_targets (post_id);

-- ---------------------------------------------------------------------------
-- The job queue - a Postgres table, claimed by the Cloudflare Worker cron.
-- ---------------------------------------------------------------------------
create table publish_jobs (
  id              uuid primary key default gen_random_uuid(),
  post_target_id  uuid not null references post_targets (id) on delete cascade,
  -- one job per target, ever - the whole idempotency guarantee
  idempotency_key text not null unique,
  status          text not null default 'queued'
                  check (status in ('queued', 'running', 'failed', 'done', 'dead')),
  run_after       timestamptz not null default now(),
  attempts        int not null default 0,
  max_attempts    int not null default 5,
  locked_at       timestamptz,
  locked_by       text,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index publish_jobs_claim_idx
  on publish_jobs (run_after)
  where status in ('queued', 'failed');

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function tj_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger posts_touch before update on posts
  for each row execute function tj_touch_updated_at();
create trigger publish_jobs_touch before update on publish_jobs
  for each row execute function tj_touch_updated_at();
