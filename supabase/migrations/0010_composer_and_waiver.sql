-- Triple Jeopardy — per-network approval waiver + composer depth.
--
-- Ava's contracts let the candidate waive approval *for Facebook and Instagram
-- specifically* while keeping it everywhere else. `approval_mode` stays the
-- campaign-wide default; `waived_networks` lists networks that publish without
-- sign-off regardless. The publish gate moves from the whole post to per-target.

alter table campaigns add column waived_networks text[] not null default '{}';
alter table campaigns add column disclaimer text;           -- "Paid for by …"

alter table posts add column first_comment text;            -- posted as the first reply
alter table posts add column body_overrides jsonb not null default '{}';  -- { network: "text" }

-- ── enqueue trigger: fan out every target, gate each job on its own network ──
create or replace function tj_enqueue_on_schedule() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_mode   text;
  v_waived text[];
begin
  select approval_mode, waived_networks into v_mode, v_waived
  from campaigns where id = new.campaign_id;

  if new.status = 'scheduled' then
    -- one target per active account, always — so the post's reach is visible
    insert into post_targets (post_id, social_account_id)
      select new.id, sa.id from social_accounts sa
      where sa.campaign_id = new.campaign_id and sa.status = 'active'
      on conflict (post_id, social_account_id) do nothing;

    -- a job for every target cleared to publish: post approved, OR the campaign
    -- waives approval outright, OR this target's network is individually waived
    insert into publish_jobs (post_target_id, idempotency_key, run_after)
      select pt.id, pt.id::text, coalesce(new.scheduled_at, now())
      from post_targets pt
      join social_accounts sa on sa.id = pt.social_account_id
      where pt.post_id = new.id
        and (
          new.approval_state = 'approved'
          or v_mode = 'waived'
          or sa.network = any(v_waived)
        )
      on conflict (idempotency_key) do nothing;

    -- scheduled time moved: roll existing queued/failed jobs forward
    if old.status = 'scheduled' and new.scheduled_at is distinct from old.scheduled_at then
      update publish_jobs j
        set run_after = coalesce(new.scheduled_at, now()), status = 'queued', last_error = null
        from post_targets pt
        where pt.post_id = new.id and j.post_target_id = pt.id
          and j.status in ('queued', 'failed');
    end if;

  -- pulled back to draft
  elsif old.status = 'scheduled' and new.status = 'draft' then
    delete from publish_jobs j using post_targets pt
      where pt.post_id = new.id and j.post_target_id = pt.id and j.status in ('queued', 'failed');
    delete from post_targets pt where pt.post_id = new.id and pt.status = 'pending';
  end if;

  return new;
end;
$$;

-- ── the review page shows the reviewer which networks they're signing off ──
-- (helper the Edge Function can call; returns the networks that still need approval)
create or replace function tj_networks_needing_approval(p_campaign uuid)
returns text[]
language plpgsql stable security definer set search_path = public as $$
declare
  v_waived text[];
  v_result text[];
begin
  select waived_networks into v_waived from campaigns where id = p_campaign;
  select coalesce(array_agg(distinct sa.network), '{}')
    into v_result
    from social_accounts sa
    where sa.campaign_id = p_campaign
      and sa.status = 'active'
      and not (sa.network = any (coalesce(v_waived, '{}')));
  return v_result;
end;
$$;

grant execute on function tj_networks_needing_approval(uuid) to authenticated;
