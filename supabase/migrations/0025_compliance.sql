-- Campaign-native compliance fields.

-- Post type — a tag, used for filtering and the fundraising thermometer.
alter table posts add column post_type text not null default 'standard'
  check (post_type in ('standard', 'fundraising', 'event', 'rapid_response'));

-- The primary CTA link (ActBlue / WinRed / RSVP), tracked apart from the body.
alter table posts add column link_url text;

-- Fundraising thermometer — operator-maintained (no ActBlue API).
alter table posts add column fundraise_goal numeric check (fundraise_goal >= 0);
alter table posts add column fundraise_raised numeric check (fundraise_raised >= 0);

-- Source-required: a post making a factual claim can't go to review until a
-- source is attached.
alter table posts add column needs_source boolean not null default false;
alter table posts add column source_url text;

-- Paid-spend log — every time an organic post is boosted into an ad. This is
-- the FEC-relevant record (48-hour and quarterly reporting).
create table post_boosts (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs (id) on delete cascade,
  post_id    uuid not null references posts (id) on delete cascade,
  platform   text not null,
  amount     numeric not null check (amount >= 0),
  started_on date,
  ended_on   date,
  audience   text,
  note       text,
  created_at timestamptz not null default now()
);
create index post_boosts_org_idx on post_boosts (org_id);

alter table post_boosts enable row level security;
create policy post_boosts_member on post_boosts
  for all to authenticated
  using (tj_is_member(org_id))
  with check (tj_is_member(org_id));
