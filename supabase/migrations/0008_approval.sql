-- Triple Jeopardy - Phase 1 approval workflow.
-- A post's `status` is the publishing pipeline (draft/scheduled/published);
-- `approval_state` is the parallel sign-off track. The publish gate lives in
-- the enqueue trigger: no publish_jobs unless the campaign waives approval or
-- the post is approved.

-- ── campaign approval config ──────────────────────────────────────
alter table campaigns add column approval_mode text not null default 'candidate'
  check (approval_mode in ('candidate', 'designated', 'waived'));
alter table campaigns add column approver_name text;
alter table campaigns add column approver_email text;

-- ── post approval state ──────────────────────────────────────────
alter table posts add column approval_state text not null default 'not_required'
  check (approval_state in ('not_required', 'pending', 'changes_requested', 'approved'));

-- ── review links (the reviewer's no-login magic link) ────────────
create table review_links (
  token       text primary key default encode(gen_random_bytes(24), 'hex'),
  post_id     uuid not null references posts (id) on delete cascade,
  campaign_id uuid not null references campaigns (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 days',
  decided_at  timestamptz,
  decision    text check (decision in ('approved', 'changes_requested'))
);
alter table review_links enable row level security;
create policy review_links_member on review_links
  for all to authenticated
  using (exists (select 1 from campaigns c where c.id = campaign_id and tj_is_member(c.org_id)))
  with check (exists (select 1 from campaigns c where c.id = campaign_id and tj_is_member(c.org_id)));

-- ── append-only approval trail ──────────────────────────────────
create table approval_events (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts (id) on delete cascade,
  event      text not null,   -- sent_for_review | approved | changes_requested | reset
  actor      text,            -- 'operator' | reviewer name | 'system'
  note       text,
  created_at timestamptz not null default now()
);
alter table approval_events enable row level security;
create policy approval_events_read on approval_events
  for select to authenticated
  using (exists (select 1 from posts p where p.id = post_id and tj_is_member(p.org_id)));
create policy approval_events_insert on approval_events
  for insert to authenticated
  with check (exists (select 1 from posts p where p.id = post_id and tj_is_member(p.org_id)));
-- no update/delete policy => append-only for the client

-- ── enqueue trigger: now with the approval gate ─────────────────
create or replace function tj_enqueue_on_schedule() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_can_publish boolean;
  v_has_jobs boolean;
begin
  v_can_publish := (
    (select approval_mode from campaigns where id = new.campaign_id) = 'waived'
    or new.approval_state = 'approved'
  );

  select exists (
    select 1 from publish_jobs j
    join post_targets pt on pt.id = j.post_target_id
    where pt.post_id = new.id
  ) into v_has_jobs;

  -- scheduled + cleared to publish + not yet enqueued -> fan out + enqueue.
  -- Covers both "just scheduled (already approved)" and "just approved (already scheduled)".
  if new.status = 'scheduled' and v_can_publish and not v_has_jobs then
    insert into post_targets (post_id, social_account_id)
      select new.id, sa.id from social_accounts sa
      where sa.campaign_id = new.campaign_id and sa.status = 'active'
      on conflict (post_id, social_account_id) do nothing;
    insert into publish_jobs (post_target_id, idempotency_key, run_after)
      select pt.id, pt.id::text, coalesce(new.scheduled_at, now())
      from post_targets pt where pt.post_id = new.id
      on conflict (idempotency_key) do nothing;

  -- still scheduled, time moved
  elsif new.status = 'scheduled' and old.status = 'scheduled'
        and new.scheduled_at is distinct from old.scheduled_at then
    update publish_jobs j
      set run_after = coalesce(new.scheduled_at, now()), status = 'queued', last_error = null
      from post_targets pt
      where pt.post_id = new.id and j.post_target_id = pt.id
        and j.status in ('queued', 'failed');

  -- pulled back to draft
  elsif old.status = 'scheduled' and new.status = 'draft' then
    delete from publish_jobs j using post_targets pt
      where pt.post_id = new.id and j.post_target_id = pt.id and j.status in ('queued', 'failed');
    delete from post_targets pt where pt.post_id = new.id and pt.status = 'pending';
  end if;

  return new;
end;
$$;

-- ── reset approval (called when an approved/pending post is edited) ──
create or replace function tj_reset_approval(p_post_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update posts set approval_state = 'not_required' where id = p_post_id;
  update review_links set decided_at = now() where post_id = p_post_id and decided_at is null;
  delete from publish_jobs j using post_targets pt
    where pt.post_id = p_post_id and j.post_target_id = pt.id and j.status in ('queued', 'failed');
  delete from post_targets pt where pt.post_id = p_post_id and pt.status = 'pending';
  insert into approval_events (post_id, event, actor, note)
    values (p_post_id, 'reset', 'operator', 'Post edited after review - approval reset');
end;
$$;
