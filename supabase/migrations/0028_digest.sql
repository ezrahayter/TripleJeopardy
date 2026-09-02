-- Weekly performance digest email. One marker so a retry inside the same day
-- can't double-send.

alter table orgs
  add column if not exists digest_enabled boolean not null default true,
  add column if not exists digest_sent_on date;
