-- Triple Jeopardy - Phase 0 functions
-- Membership check, workspace bootstrap, job enqueue trigger, and the
-- claim / complete / fail cycle the worker calls over RPC.

-- ---------------------------------------------------------------------------
-- Is the current user a member of this org? SECURITY DEFINER so RLS policies
-- can call it without recursing into memberships' own policy.
-- ---------------------------------------------------------------------------
create or replace function tj_is_member(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.org_id = p_org and m.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- First-run: create a workspace, make the caller its owner, add one campaign.
-- Returns the new org id.
-- ---------------------------------------------------------------------------
create or replace function tj_bootstrap(p_org_name text, p_campaign_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into orgs (name)
    values (coalesce(nullif(trim(p_org_name), ''), 'My Workspace'))
    returning id into v_org;

  insert into memberships (org_id, user_id, role)
    values (v_org, auth.uid(), 'owner');

  insert into campaigns (org_id, name)
    values (v_org, coalesce(nullif(trim(p_campaign_name), ''), 'First Campaign'));

  return v_org;
end;
$$;

-- ---------------------------------------------------------------------------
-- When a post flips to 'scheduled', fan out one target per active account
-- and enqueue exactly one job per target.
-- ---------------------------------------------------------------------------
create or replace function tj_enqueue_on_schedule() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'scheduled' and new.status is distinct from old.status then
    insert into post_targets (post_id, social_account_id)
      select new.id, sa.id
      from social_accounts sa
      where sa.campaign_id = new.campaign_id
        and sa.status = 'active'
      on conflict (post_id, social_account_id) do nothing;

    insert into publish_jobs (post_target_id, idempotency_key, run_after)
      select pt.id, pt.id::text, coalesce(new.scheduled_at, now())
      from post_targets pt
      where pt.post_id = new.id
      on conflict (idempotency_key) do nothing;
  end if;
  return new;
end;
$$;

create trigger posts_enqueue after update on posts
  for each row execute function tj_enqueue_on_schedule();

-- ---------------------------------------------------------------------------
-- Worker: claim due jobs. SKIP LOCKED lets several worker invocations run
-- without stepping on each other.
-- ---------------------------------------------------------------------------
create or replace function tj_claim_publish_jobs(p_worker text, p_limit int default 10)
returns setof publish_jobs
language sql security definer set search_path = public as $$
  update publish_jobs j
  set status = 'running',
      locked_at = now(),
      locked_by = p_worker,
      attempts = j.attempts + 1
  where j.id in (
    select id from publish_jobs
    where status in ('queued', 'failed')
      and run_after <= now()
    order by run_after
    limit p_limit
    for update skip locked
  )
  returning j.*;
$$;

-- ---------------------------------------------------------------------------
-- Worker: mark a job done and roll the state up to the post.
-- ---------------------------------------------------------------------------
create or replace function tj_complete_job(
  p_job uuid, p_external_id text, p_external_url text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_target uuid;
  v_post   uuid;
begin
  update publish_jobs
    set status = 'done', last_error = null
    where id = p_job
    returning post_target_id into v_target;

  update post_targets
    set status = 'published',
        external_post_id = p_external_id,
        external_url = p_external_url,
        error = null,
        published_at = now()
    where id = v_target
    returning post_id into v_post;

  update posts p
    set status = 'published'
    where p.id = v_post
      and not exists (
        select 1 from post_targets t
        where t.post_id = v_post and t.status <> 'published'
      );
end;
$$;

-- ---------------------------------------------------------------------------
-- Worker: a job threw. Back off exponentially, or bury it after max_attempts.
-- ---------------------------------------------------------------------------
create or replace function tj_fail_job(p_job uuid, p_error text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_attempts int;
  v_max      int;
  v_target   uuid;
begin
  select attempts, max_attempts, post_target_id
    into v_attempts, v_max, v_target
    from publish_jobs where id = p_job;

  if v_attempts >= v_max then
    update publish_jobs set status = 'dead', last_error = p_error where id = p_job;
    update post_targets set status = 'failed', error = p_error where id = v_target;
    update posts set status = 'failed'
      where id = (select post_id from post_targets where id = v_target);
  else
    update publish_jobs
      set status = 'failed',
          last_error = p_error,
          run_after = now() + make_interval(mins => power(2, v_attempts)::int)
      where id = p_job;
  end if;
end;
$$;

grant execute on function tj_bootstrap(text, text) to authenticated;
