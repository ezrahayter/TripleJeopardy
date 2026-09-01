# Triple Jeopardy — roadmap & current state

Authoritative "where we are / what's next" for a fresh context window. Update the
dated status block whenever something ships. The exhaustive feature checklist
(everything Buffer/Hootsuite/Planable have, grouped by area) lives in
[`docs/feature-backlog.md`](docs/feature-backlog.md) — this file is the *plan*,
that one is the *catalogue*.

Product: a social publishing tool for a freelance social-media manager (Ava
Weston) who runs political **candidates'** feeds, made by **Positive Force**
(no "FL"). The wedge is the **approval workflow** — nothing publishes until the
candidate signs off, with a timestamped audit trail. Named after the Third World
Women's Alliance newspaper.

Networks: Facebook, Instagram, Threads, Bluesky, TikTok, YouTube. **No X/Twitter**
(paid API), **no LinkedIn**, **no SMS/automated calls** anywhere (email + web push
only). Runs on free tiers (~$12/yr domain the only cost).

---

## Status — 2026-09-01

> **2026-09-01 update:** candidate **post requests** now ship in the same
> `/review/<token>` portal — a 4-step wizard mirroring Ava's old Google Form
> ("[client] Social Media Request"), with image upload. Requests land in a new
> operator **Requests** inbox (`/requests`, nav item after Approvals); accepting
> one spins up a draft post (body + copied media) and drops you in Compose.
> New: migration `0012` (`post_requests`, `post_request_media`,
> `campaigns.requests_enabled`); `review` Edge Function gained
> `action:'sign-upload'` / `action:'request'` (redeploy it). The Google Form is
> retired.

### Live
- **web** → https://triple-jeopardy.pages.dev (Cloudflare Pages)
- **worker** → deployed, cron `* * * * *` (the publisher)
- **Supabase** ref `zompyktytkwyueedshzk`; migrations **0001–0011 applied**
  (⬜ **0012** written, not yet pushed — run `npx supabase db push` +
  `npx supabase functions deploy review`)
- GitHub `git@github.com:ezrahayter/TripleJeopardy.git`

### Shipped
- Phase 0 skeleton; **Bluesky publish proven end-to-end**
- Operator auth = email + password (magic links are **only** for candidate/reviewer)
- Multiple workspaces; teammates (invite by email, shared connections)
- Content calendar that works with no socials connected
- **Approval workflow (the wedge)** — fully built + tested:
  - Campaign approval modes: candidate / designated / waived
  - **Per-network waiver** — waive FB+IG specifically, keep approval elsewhere
    (publish gate is per-target: migration 0010)
  - **One stable review portal per campaign** (`campaigns.review_token`,
    migration 0011) — candidate opens the same `/review/<token>` page every time,
    works through everything pending; no per-post magic links
  - Append-only `approval_events`; **printable compliance record** per campaign
    or workspace (ApprovalReport.tsx, `window.print()`)
- **Full UI redesign** — Tailwind v4 + shadcn/ui + vendored Kibo UI, Ink sidebar
  shell, Overview dashboard, rich Posts cards, **drag-to-reschedule** calendar
  (month/week), advanced Compose (live per-network preview, char rings, network
  picker, drag-drop media, schedule popover)
- **Composer depth** — campaign disclaimer auto-append, per-network text
  overrides (`posts.body_overrides`, honoured by the worker), first comment
  (`posts.first_comment` — stored + previewed, **not yet published**, see P1)
- **Analytics** — publishing volume, 12-week cadence, per-network split,
  published-post list from real target data. Reach/engagement is a placeholder
  until a metrics-sync backend exists (P1).
- Delete a post from any pre-published state (Posts + Approvals kebab menu)
- Route-level code-splitting (main bundle ~289 KB / 89 KB gzip)

### Blocked — needs Ezra, not code
- **Meta OAuth connect.** Last observed: the FB authorize dialog showed
  *"Feature Unavailable — updating additional details for this app"* (Meta
  re-indexing after a Basic-Settings change; usually clears in hours). **Retry:
  Accounts → Connect Facebook / Instagram.** Until this works nothing reaches
  FB/IG, and the Graph adapters (`shared/src/adapters/{facebook,instagram}.ts`)
  have **never run against a live app** — expect field-name / permalink /
  container-polling fixes once they do.
  - Meta app: "TripleJeopardy2", App ID `4393495657579660`. Development mode,
    Standard Access permissions (no App Review needed for testers/admins).
    Redirect URI: `https://zompyktytkwyueedshzk.supabase.co/functions/v1/oauth-callback`
  - See [`docs/meta-setup.md`](docs/meta-setup.md) for the full setup.
- **Add Ava as a Meta tester** — `ava.weston.679808` via App roles → Testers.
  She hit the dev-registration SMS wall; the Business-Portfolio route (add her
  as a person there) sidesteps it. She does **not** need Meta access to operate —
  she publishes through connections Ezra makes.
- **Meta business verification** — weeks-long, needed before App Review / public.
- **Threads** — needs its **own separate Meta app** (the use-case dialog didn't
  offer Threads on this app).

---

## Roadmap — priority order

Phases are P1 (next) → P4 (someday). `*ours*` = campaign-native, no competitor has it.

### P1 — the near-term unlock list
1. **Get Meta connecting** (Ezra retries) → then a session debugging the live
   FB/IG adapters against a sandbox Page.
2. **Auto-email** (Resend free tier — already planned, was deferred):
   - post sent for review → email the candidate the portal link
   - candidate approves / requests changes → email Ava
   - **candidate submits a post request → email Ava** (the Requests inbox is
     silent today, same as approvals were)
   - currently silent, so Ava has to text the candidate every time
3. **Bluesky metrics sync** — worker/edge step that pulls likes/reposts/replies
   into `post_targets` (add `metrics jsonb` + `metrics_synced_at`), so the
   Analytics page shows real reach. Meta metrics slot into the same shape later.
4. **First-comment publishing** — stored + previewed today; wire the worker to
   post it as a reply (needs `NetworkAdapter.publish` to accept `replyTo` or a
   follow-up call). Bluesky first.
5. **Meta token refresh hardening** — `worker/src/refresh.ts` exists but has only
   run against dead apps.

### P2 — depth, once P1 lands
- **Approval:** inline comments on the caption/image (Planable-style), approval
  deadlines + auto-nudge, revision-round tracking UI, internal notes per post.
- **Compose/schedule:** posting-time queue ("next slot"), recurring posts,
  thread/carousel composer, link shortener + UTM builder, saved
  caption/hashtag snippets, emoji picker.
- **Calendar:** filter by campaign/network/status, campaign date anchors
  (election day, filing deadlines, debates), color-coding, Google Calendar /
  iCal feed.
- **Analytics:** nightly metric snapshots → time series, plain-language campaign
  recap, top/bottom posts, scheduled report emails, shareable live report link.
- **Compliance (*ours*):** disclaimer enforcement (block publish without it),
  boost/paid-spend log for FEC, source-required posts, fundraising post type +
  goal thermometer + ActBlue/WinRed attribution, kill switch (pause all).
- **Content sourcing:** RSS → drafts, evergreen recycling, bulk CSV upload,
  draft-from-a-link. (Candidate request intake shipped 2026-09-01 — a full
  kanban with the spreadsheet's Short-notice / Media-missing / Need-approval
  columns is the remaining depth here.)
- **Media:** media library, per-network aspect-ratio crop (Kibo `image-crop` is
  already vendored, unused), video passthrough, alt-text fields for all networks.
- **AI:** caption gen/rewrite, tone adjustment, "feedback translator" (vague
  note → concrete edits), rapid-response draft options.
- **Client read-only calendar view.**

### P3 — scale / polish
- TikTok + YouTube adapters + OAuth.
- Multi-stage / role-based approval routing; granular permissions.
- White-label review rooms & reports (per-campaign logo + one accent).
- Mobile PWA / "share to Triple Jeopardy".
- Canva Connect API import (needs Canva dev account + API approval).
- Account-type firewall (official / personal / surrogate).

### P4 — far out
- Unified inbox (comments/mentions/DMs), moderation, harassment triage.
- Listening: keyword streams, mention monitoring, opponent tracking.
- Competitor benchmarking, custom dashboards, Zapier/webhooks.

---

## How to work on this

### Deploy
```bash
export PATH="/usr/local/bin:$PATH"                       # node v24 lives here
export CLOUDFLARE_API_TOKEN="cfut_…"                     # ask Ezra / see chat history

cd web && npm run build && \
  npx wrangler pages deploy dist --project-name=triple-jeopardy --branch=main --commit-dirty=true

cd worker && npx wrangler deploy

cd .. && npx supabase db push                            # migrations
npx supabase functions deploy <name>                    # oauth-start / oauth-callback / review / connect-bluesky
```
Push: `GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519_calltimeweb -o IdentitiesOnly=yes" git push`

### Testing the authed app
No signup UI (operators are admin-created). For a throwaway session use the
Supabase Admin API with the service key:
```bash
curl -sX POST "$SUPABASE_URL/auth/v1/admin/users" -H "apikey: $SVC" -H "Authorization: Bearer $SVC" \
  -H "Content-Type: application/json" -d '{"email":"tj-test@…","password":"…","email_confirm":true}'
```
Clean up by deleting the org (`DELETE /rest/v1/orgs?id=eq.…`, cascades) then the
user. **The worker cron is live** — test data with `publish_jobs` will be picked
up (and fail harmlessly on fake accounts). Prefer seeding without connected
accounts, or delete jobs after.

### Gotchas
- `shared/` can't be imported by Edge Functions → `supabase/functions/_shared/`
  is a hand-kept mirror (crypto, cors). Keep them in sync.
- `TJ_ENCRYPTION_KEY` must be byte-identical across Supabase secrets,
  `worker/.dev.vars`, and deployed worker secrets.
- pgcrypto lives in the `extensions` schema on Supabase → always
  `extensions.gen_random_bytes(…)`.
- The enqueue gate is the `tj_enqueue_on_schedule` trigger. It fans out one
  `post_target` per active account whenever a post is `scheduled`, but only
  queues a `publish_job` per target when: post `approved`, OR campaign
  `approval_mode = 'waived'`, OR that target's network is in
  `campaigns.waived_networks`. A scheduled-but-unapproved post sits idle until
  someone hits "Send for review" and the candidate approves — **this is by
  design** (Ezra confirmed 2026-09-01).
- shadcn's current components need React 19 (we upgraded from 18) — `radix-ui`
  unified package, `asChild` needs ref-forwarding.
- Vendored skills in `.claude/skills/` (frontend-design, ui-styling, kibo, etc.)
  — provenance + audit in `.claude/skills/VENDORING.md`.

### CLAUDE.md
`CLAUDE.md`'s "Status (2026-08-31)" block is **stale** (pre-everything). Trust
this file for status; CLAUDE.md is still right on architecture principles.
