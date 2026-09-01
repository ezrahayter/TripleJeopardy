-- Triple Jeopardy - workspace teammates.
-- An owner invites a colleague by email. If that email already has an account
-- they're attached immediately; otherwise the invite is claimed the first time
-- they sign in with that email. No email is sent (that's P2) - the owner tells
-- them the address to use.

create table workspace_invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs (id) on delete cascade,
  email       text not null,
  role        text not null default 'editor'
              check (role in ('owner', 'editor', 'contributor', 'viewer')),
  invited_by  uuid references auth.users (id),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id),
  unique (org_id, email)
);
alter table workspace_invites enable row level security;

-- members see their workspace's invites; only owners write them
create policy workspace_invites_read on workspace_invites
  for select to authenticated using (tj_is_member(org_id));
create policy workspace_invites_write on workspace_invites
  for all to authenticated
  using (tj_is_owner(org_id)) with check (tj_is_owner(org_id));

-- ── members can see every membership row in their own workspaces ──
-- (0001 only exposed the caller's own row; the Team screen needs the rest)
create policy memberships_read_org on memberships
  for select to authenticated using (tj_is_member(org_id));

-- ── owner invites someone ───────────────────────────────────────
create or replace function tj_invite_member(p_org uuid, p_email text, p_role text default 'editor')
returns workspace_invites
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_uid   uuid;
  v_row   workspace_invites;
begin
  if not tj_is_owner(p_org) then
    raise exception 'Only a workspace owner can invite people.';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Enter a valid email address.';
  end if;

  select id into v_uid from auth.users where lower(email) = v_email;

  if v_uid is not null and exists (
    select 1 from memberships where org_id = p_org and user_id = v_uid
  ) then
    raise exception 'That person is already in this workspace.';
  end if;

  insert into workspace_invites (org_id, email, role, invited_by)
    values (p_org, v_email, coalesce(nullif(p_role, ''), 'editor'), auth.uid())
  on conflict (org_id, email) do update
    set role = excluded.role, invited_by = excluded.invited_by,
        created_at = now(), accepted_at = null, accepted_by = null
  returning * into v_row;

  -- account already exists -> attach now
  if v_uid is not null then
    insert into memberships (org_id, user_id, role)
      values (p_org, v_uid, v_row.role)
    on conflict (org_id, user_id) do nothing;
    update workspace_invites
      set accepted_at = now(), accepted_by = v_uid
      where id = v_row.id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

-- ── caller claims any invites addressed to their email ──────────
-- Called by the web app on every load, before it lists workspaces.
create or replace function tj_accept_invites() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_email text := (select lower(email) from auth.users where id = auth.uid());
  v_count int := 0;
begin
  if v_email is null then return 0; end if;

  with claimed as (
    update workspace_invites wi
      set accepted_at = now(), accepted_by = auth.uid()
      where lower(wi.email) = v_email and wi.accepted_at is null
      returning wi.org_id, wi.role
  )
  insert into memberships (org_id, user_id, role)
    select org_id, auth.uid(), role from claimed
  on conflict (org_id, user_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ── list workspace members (with email, which lives in auth.users) ──
create or replace function tj_list_members(p_org uuid)
returns table (user_id uuid, email text, role text, joined_at timestamptz)
language sql security definer set search_path = public as $$
  select m.user_id, u.email, m.role, m.created_at
  from memberships m
  join auth.users u on u.id = m.user_id
  where m.org_id = p_org and tj_is_member(p_org)
  order by m.created_at;
$$;

-- ── owner removes a member (can't remove the last owner) ────────
create or replace function tj_remove_member(p_org uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tj_is_owner(p_org) then
    raise exception 'Only a workspace owner can remove people.';
  end if;
  if (select role from memberships where org_id = p_org and user_id = p_user) = 'owner'
     and (select count(*) from memberships where org_id = p_org and role = 'owner') <= 1 then
    raise exception 'That is the only owner - make someone else an owner first.';
  end if;
  delete from memberships where org_id = p_org and user_id = p_user;
  delete from workspace_invites wi
    where wi.org_id = p_org
      and wi.email = (select lower(email) from auth.users where id = p_user);
end;
$$;

grant execute on function tj_invite_member(uuid, text, text) to authenticated;
grant execute on function tj_accept_invites() to authenticated;
grant execute on function tj_list_members(uuid) to authenticated;
grant execute on function tj_remove_member(uuid, uuid) to authenticated;
