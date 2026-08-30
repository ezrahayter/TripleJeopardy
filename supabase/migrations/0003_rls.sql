-- Triple Jeopardy - Phase 0 row-level security
-- Rule: you see a row iff you are a member of its org. The worker and the
-- connect-bluesky function use the service role and bypass all of this.

alter table orgs             enable row level security;
alter table memberships      enable row level security;
alter table campaigns        enable row level security;
alter table campaign_people  enable row level security;
alter table social_accounts  enable row level security;
alter table posts            enable row level security;
alter table post_media       enable row level security;
alter table post_targets     enable row level security;
alter table publish_jobs     enable row level security;

-- orgs -------------------------------------------------------------------
create policy orgs_read on orgs
  for select to authenticated using (tj_is_member(id));

-- memberships ----------------------------------------------------------
create policy memberships_read_own on memberships
  for select to authenticated using (user_id = auth.uid());

-- campaigns ----------------------------------------------------------------
create policy campaigns_all on campaigns
  for all to authenticated
  using (tj_is_member(org_id))
  with check (tj_is_member(org_id));

-- campaign_people --------------------------------------------------------
create policy campaign_people_all on campaign_people
  for all to authenticated
  using (exists (select 1 from campaigns c where c.id = campaign_id and tj_is_member(c.org_id)))
  with check (exists (select 1 from campaigns c where c.id = campaign_id and tj_is_member(c.org_id)));

-- social_accounts ------------------------------------------------------
-- Readable/removable by members; rows are created by the connect-bluesky
-- Edge Function (service role), never straight from the client.
create policy social_accounts_read on social_accounts
  for select to authenticated using (tj_is_member(org_id));
create policy social_accounts_delete on social_accounts
  for delete to authenticated using (tj_is_member(org_id));

-- posts ------------------------------------------------------------------
create policy posts_all on posts
  for all to authenticated
  using (tj_is_member(org_id))
  with check (tj_is_member(org_id));

-- post_media -----------------------------------------------------------
create policy post_media_all on post_media
  for all to authenticated
  using (exists (select 1 from posts p where p.id = post_id and tj_is_member(p.org_id)))
  with check (exists (select 1 from posts p where p.id = post_id and tj_is_member(p.org_id)));

-- post_targets --------------------------------------------------------
create policy post_targets_read on post_targets
  for select to authenticated
  using (exists (select 1 from posts p where p.id = post_id and tj_is_member(p.org_id)));

-- publish_jobs -------------------------------------------------------
create policy publish_jobs_read on publish_jobs
  for select to authenticated
  using (exists (
    select 1
    from post_targets t
    join posts p on p.id = t.post_id
    where t.id = post_target_id and tj_is_member(p.org_id)
  ));
