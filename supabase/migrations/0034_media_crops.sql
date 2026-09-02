-- Per-network aspect-ratio crops. { "<network>": "<storage_path>" } — the
-- publisher uses the network's variant when present, else the original.

alter table post_media
  add column if not exists crops jsonb not null default '{}'::jsonb;
