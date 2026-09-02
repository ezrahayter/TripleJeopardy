-- Kill switch: pause all publishing for a campaign. Queued jobs are held (not
-- cancelled) and resume when unpaused. Only the claim function needs to know —
-- jobs still enqueue normally, they just don't get picked up while paused.

alter table campaigns add column publishing_paused boolean not null default false;

create or replace function tj_claim_publish_jobs(p_worker text, p_limit int default 10)
returns setof publish_jobs
language sql security definer set search_path = public as $$
  update publish_jobs j
  set status = 'running',
      locked_at = now(),
      locked_by = p_worker,
      attempts = j.attempts + 1
  where j.id in (
    select pj.id
    from publish_jobs pj
    join post_targets pt on pt.id = pj.post_target_id
    join posts p on p.id = pt.post_id
    join campaigns c on c.id = p.campaign_id
    where pj.status in ('queued', 'failed')
      and pj.run_after <= now()
      and not c.publishing_paused
    order by pj.run_after
    limit p_limit
    for update of pj skip locked
  )
  returning j.*;
$$;
