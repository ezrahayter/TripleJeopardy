-- Where the team gets notified when a candidate acts on the portal — a new post
-- request, an approval, or a change request. One address per workspace (Ava runs
-- many campaigns from one inbox). Null = notifications off.
alter table orgs add column notify_email text;
