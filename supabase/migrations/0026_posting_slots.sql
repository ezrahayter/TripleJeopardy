-- Posting-time queue: a campaign can define recurring slots (e.g. Mon 9:00,
-- Wed 12:00) and the composer drops a draft into the next open one.
--
-- Shape: jsonb array of { "dow": 0-6 (0 = Sunday), "time": "HH:MM" }.

alter table campaigns
  add column if not exists posting_slots jsonb not null default '[]'::jsonb;
