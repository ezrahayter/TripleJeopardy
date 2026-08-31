-- Triple Jeopardy - let the calendar move or cancel a scheduled post.
-- The enqueue trigger now also handles reschedule (time moved) and unschedule
-- (pulled back to draft).

create or replace function tj_enqueue_on_schedule() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- newly scheduled: one target per active account, one job per target
  if new.status = 'scheduled' and old.status is distinct from 'scheduled' then
    insert into post_targets (post_id, social_account_id)
      select new.id, sa.id
      from social_accounts sa
      where sa.campaign_id = new.campaign_id and sa.status = 'active'
      on conflict (post_id, social_account_id) do nothing;

    insert into publish_jobs (post_target_id, idempotency_key, run_after)
      select pt.id, pt.id::text, coalesce(new.scheduled_at, now())
      from post_targets pt
      where pt.post_id = new.id
      on conflict (idempotency_key) do nothing;

  -- still scheduled, time changed: push the not-yet-sent jobs to the new time
  elsif new.status = 'scheduled' and old.status = 'scheduled'
        and new.scheduled_at is distinct from old.scheduled_at then
    update publish_jobs j
      set run_after = coalesce(new.scheduled_at, now()),
          status = 'queued',
          last_error = null
      from post_targets pt
      where pt.post_id = new.id
        and j.post_target_id = pt.id
        and j.status in ('queued', 'failed');

  -- pulled back to draft: cancel anything not already published
  elsif old.status = 'scheduled' and new.status = 'draft' then
    delete from publish_jobs j
      using post_targets pt
      where pt.post_id = new.id
        and j.post_target_id = pt.id
        and j.status in ('queued', 'failed');
    delete from post_targets pt
      where pt.post_id = new.id and pt.status = 'pending';
  end if;

  return new;
end;
$$;
