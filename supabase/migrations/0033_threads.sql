-- Thread composer: a post can carry extra parts that publish as a native
-- reply-chain (Bluesky + Threads). Part 1 is the post body + its media; the
-- extra parts are text-only.
--
-- posts.thread_parts: jsonb array of { "body": "..." }, [] for a normal post.

alter table posts
  add column if not exists thread_parts jsonb not null default '[]'::jsonb;

alter table post_targets
  add column if not exists thread_posted int not null default 0,
  add column if not exists thread_error text;
