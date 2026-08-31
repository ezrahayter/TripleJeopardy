-- Triple Jeopardy - let an owner rename or delete their workspace from the app.
-- Deleting an org cascades to campaigns, social_accounts, posts, jobs, memberships.

create or replace function tj_is_owner(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.org_id = p_org
      and m.user_id = auth.uid()
      and m.role = 'owner'
  );
$$;

create policy orgs_update on orgs
  for update to authenticated
  using (tj_is_owner(id))
  with check (tj_is_owner(id));

create policy orgs_delete on orgs
  for delete to authenticated
  using (tj_is_owner(id));
