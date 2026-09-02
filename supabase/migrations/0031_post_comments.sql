-- Inline discussion on a post — the operator and the candidate leave threaded
-- notes on the draft without it counting as an approval decision.

create table if not exists post_comments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  post_id     uuid not null references posts(id) on delete cascade,
  author      text not null,            -- 'operator' | 'reviewer'
  author_name text,
  body        text not null,
  anchor      text,                     -- null = whole post; else 'caption' | network id
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists post_comments_post_idx on post_comments (post_id, created_at);

alter table post_comments enable row level security;

create policy post_comments_member on post_comments
  for all to authenticated
  using (tj_is_member(org_id))
  with check (tj_is_member(org_id));
