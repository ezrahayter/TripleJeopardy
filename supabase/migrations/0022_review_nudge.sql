-- Auto-nudge: if a post has sat unapproved past the campaign's nudge window,
-- re-email the candidate their portal link. 0 = off (the default).
alter table campaigns add column review_nudge_hours int not null default 0
  check (review_nudge_hours >= 0);

alter table posts add column review_reminded_at timestamptz;
