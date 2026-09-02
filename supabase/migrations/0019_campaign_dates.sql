-- Key dates a campaign plans around — election day, filing deadlines, debates,
-- fundraising deadlines. Shown as anchors on the calendar so the schedule is
-- read against the race, not just the month.

create table campaign_dates (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs (id) on delete cascade,
  campaign_id uuid not null references campaigns (id) on delete cascade,
  label       text not null,
  date        date not null,
  kind        text not null default 'milestone'
              check (kind in ('election', 'filing', 'debate', 'fundraising', 'milestone')),
  created_at  timestamptz not null default now()
);
create index campaign_dates_campaign_idx on campaign_dates (campaign_id);
create index campaign_dates_date_idx on campaign_dates (org_id, date);

alter table campaign_dates enable row level security;
create policy campaign_dates_member on campaign_dates
  for all to authenticated
  using (tj_is_member(org_id))
  with check (tj_is_member(org_id));
