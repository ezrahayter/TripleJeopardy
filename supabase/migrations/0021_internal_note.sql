-- An operator-only note on a post — context for the team, never shown to the
-- candidate on the review portal.
alter table posts add column internal_note text;
