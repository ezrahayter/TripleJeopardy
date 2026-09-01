-- Triple Jeopardy — candidate post requests from the review portal.
--
-- Before: the candidate's `/review/<token>` page only approved / sent back posts
-- already in the pipeline. Requesting content lived in an outside Google Form
-- ("[client] Social Media Request") that the manager hand-copied into a
-- spreadsheet. Now the same portal link takes requests: the candidate fills a
-- short wizard, the manager triages them in an in-app inbox, and accepting one
-- spins up a draft post that flows through the normal compose → approval track.

-- ── opt-out switch per campaign ──────────────────────────────────
alter table campaigns
  add column requests_enabled boolean not null default true;

-- ── the request itself (mirrors the Google Form fields) ──────────
create table post_requests (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references orgs (id) on delete cascade,
  campaign_id              uuid not null references campaigns (id) on delete cascade,
  submitter_email          text,
  request_kinds            text[] not null default '{}',   -- Event promotion, Fundraising push, …
  content_type             text,                           -- Static graphic, Reel, Carousel, …
  tied_to_event            boolean not null default false,
  event_date               date,
  event_time               text,                           -- free text ("6:30 PM") — no tz math
  event_location           text,
  rsvp_link                text,
  photos_video             text,                           -- have | coming_soon | none
  exact_wording            text,                           -- must appear verbatim
  caption                  text,
  reference                text,                           -- a post to base it on
  notes                    text,                           -- "anything else"
  platforms                text[] not null default '{}',
  planned_publish          date,
  needs_submitter_approval boolean not null default false,
  draft_lead               text,                           -- "24 hours in advance", …
  status                   text not null default 'new'
                           check (status in ('new', 'accepted', 'declined')),
  decline_reason           text,
  assigned_to              text,                           -- free text, feeds nothing yet
  created_post_id          uuid references posts (id) on delete set null,
  decided_at               timestamptz,
  created_at               timestamptz not null default now()
);
create index post_requests_org_status_idx on post_requests (org_id, status);
create index post_requests_campaign_idx on post_requests (campaign_id);

create table post_request_media (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references post_requests (id) on delete cascade,
  storage_path text not null,                              -- object key in the private 'media' bucket
  kind         text not null default 'media'
               check (kind in ('resource', 'media')),
  sort         int not null default 0
);
create index post_request_media_request_idx on post_request_media (request_id);

-- ── RLS: member of the org or you don't see it ──────────────────
-- The `review` Edge Function inserts with the service role and bypasses this.
alter table post_requests enable row level security;
create policy post_requests_member on post_requests
  for all to authenticated
  using (tj_is_member(org_id))
  with check (tj_is_member(org_id));

alter table post_request_media enable row level security;
create policy post_request_media_member on post_request_media
  for all to authenticated
  using (exists (
    select 1 from post_requests r
    where r.id = request_id and tj_is_member(r.org_id)
  ))
  with check (exists (
    select 1 from post_requests r
    where r.id = request_id and tj_is_member(r.org_id)
  ));
