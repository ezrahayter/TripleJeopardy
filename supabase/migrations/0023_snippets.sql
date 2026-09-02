-- Reusable caption / hashtag / boilerplate blocks the team drops into a post.
-- campaign_id null = available to every campaign in the workspace.
create table snippets (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs (id) on delete cascade,
  campaign_id uuid references campaigns (id) on delete cascade,
  label       text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index snippets_org_idx on snippets (org_id);

alter table snippets enable row level security;
create policy snippets_member on snippets
  for all to authenticated
  using (tj_is_member(org_id))
  with check (tj_is_member(org_id));
