-- Triple Jeopardy — one stable review portal per campaign.
--
-- Before: every "send for review" minted a new per-post magic link the operator
-- had to forward. Now each campaign has one durable token; the candidate opens
-- the same page every time and works through everything that's pending.

alter table campaigns
  add column review_token text unique not null
  default encode(extensions.gen_random_bytes(24), 'hex');

-- rotate it if the link is ever shared too widely
create or replace function tj_rotate_review_token(p_campaign uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_token text;
begin
  if not exists (
    select 1 from campaigns c
    where c.id = p_campaign and tj_is_member(c.org_id)
  ) then
    raise exception 'not found';
  end if;
  update campaigns
    set review_token = encode(extensions.gen_random_bytes(24), 'hex')
    where id = p_campaign
    returning review_token into v_token;
  return v_token;
end;
$$;

grant execute on function tj_rotate_review_token(uuid) to authenticated;

-- review_links is no longer minted per post; the table stays for the historical
-- rows and the harmless reference in tj_reset_approval.
