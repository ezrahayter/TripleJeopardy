-- First-comment publishing + token-refresh visibility.

-- The worker posts posts.first_comment as a reply/comment right after the main
-- post. Track the outcome per target so it shows in the UI and isn't retried.
alter table post_targets add column comment_external_id text;
alter table post_targets add column comment_error text;

-- Why the last Meta token refresh failed (null = healthy).
alter table social_accounts add column token_error text;
