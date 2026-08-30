-- Triple Jeopardy - Phase 0 media storage
-- Private bucket. Paths are `<campaign_id>/<post_id>/<file>`. Phase 1: tighten
-- these policies to the caller's own campaigns rather than any signed-in user.

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

create policy media_read on storage.objects
  for select to authenticated using (bucket_id = 'media');

create policy media_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'media');

create policy media_update on storage.objects
  for update to authenticated using (bucket_id = 'media');

create policy media_delete on storage.objects
  for delete to authenticated using (bucket_id = 'media');
