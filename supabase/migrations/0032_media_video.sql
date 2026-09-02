-- Allow video uploads in the media bucket. 200 MB ceiling — matches the
-- composer's client-side guard (web/src/lib/media.ts MAX_VIDEO_MB).
--
-- Note: Supabase also enforces a project-wide upload limit. If it's lower than
-- this, raise it in Dashboard → Storage → Settings.

update storage.buckets
set file_size_limit = 209715200
where id = 'media';
