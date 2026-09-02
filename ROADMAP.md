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

### Meta — Facebook publish PROVEN (2026-09-01)
- **Facebook connect + publish works end to end.** TJ Sandbox Page connected via
  Login-for-Business OAuth, worker published a text post
  (`facebook.com/.../posts/122103845691456588`). `shared/src/adapters/facebook.ts`
  needed **no fixes** — ran correctly first time against the live app.
- **The working recipe (Development mode, no App Review):**
  1. App in **Development mode** (Live mode was the cause of "Feature Unavailable").
  2. **Ezra** authorizes — he's the app admin, and needs a **role on the Page**
     (Content task access = instant; Full control = 7-day hold).
  3. New **assign-to-campaign** panel (migration 0013, `connect-assign` fn) routes
     each granted Page/IG to a campaign.
  - Ava / any non-app-role account **cannot** authorize — Meta now requires
    developer registration for app access via *every* route (App Roles AND
    Business Portfolio), and Ezra can't pass the dev SMS wall. Ava operates the
    app; Ezra holds every Meta connection. This is fine — matches the model.
- **Still unproven:** `instagram.ts` (container create + poll), image/media posts
  (different endpoints), Threads (needs its own separate app).
- **App:** "TripleJeopardy2", ID `4393495657579660`. Also fixed: `/privacy` is now
  a static crawlable page (`web/public/privacy.html`) — Meta's crawler runs no JS.
  See [`docs/meta-setup.md`](docs/meta-setup.md).

### Blocked — needs Ezra, not code
- **Business verification + App Review** — the durable path to letting Ava (and
  real candidates) connect their own Pages without Ezra in the loop. Business
  verification for Positive Force LLC started 2026-09-01 (document + phone-call
  method; "@pages.dev" email option is broken — Meta guessed the domain from the
  app URL). Then App Review for `pages_manage_posts` / `instagram_content_publish`
  / `business_management` (screencast + written use-case). Multi-week.
  Alternative worth building: **System User token** scoped to Business-owned Page
  assets — removes per-person OAuth entirely.
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
1. **Meta:** ✅ Facebook connect + publish proven. Remaining: prove
   `instagram.ts` (Business IG on the sandbox Page), prove image/media posts on
   FB + IG, then business verification + App Review (see the Meta block above).
2. **Auto-email** (Resend) — ✅ built + live 2026-09-01, all verified end to end:
   - candidate submits a request / approves / requests changes → emails
     `orgs.notify_email` (Settings → Notification email)
   - operator hits "Send for review" → emails the campaign's `approver_email`
     the stable portal link (`notify-candidate` edge fn)
   - `RESEND_API_KEY` is set; `positiveforce.win` added to Resend (domain id
     `641c4750-7c7c-49dc-8e58-641a5160ba96`), DNS at **Njalla** — partner adding
     the 3 records (DKIM `resend._domainkey` TXT, `send` TXT SPF, `send` MX)
     ~2026-09-02. **Then:** `POST /domains/<id>/verify`, set
     `EMAIL_FROM="Triple Jeopardy <notifications@positiveforce.win>"`, redeploy
     `review` + `notify-candidate`. Until then Resend only delivers to
     `ezra@positiveforce.win`.
3. **Metrics sync** — ✅ built 2026-09-01. `post_targets.metrics` +
   `metrics_synced_at` (migration 0016); a worker step
   (`worker/src/metrics.ts`, every 10 min, 6h per-post gate, 30-day window)
   calls `adapter.fetchMetrics` for each network. **Bluesky proven live**
   (likes/reposts/replies/quotes via the public appview). FB (likes/comments/
   shares + reach if `read_insights`), IG (like/comment counts + reach/saves/
   shares), Threads (likes/replies/reposts/quotes/views) implemented, unproven
   pending a live post. Analytics page + Posts cards + the post detail sheet
   show engagement (shared `PostMetricsBar`).
4. **First-comment publishing** — ✅ built 2026-09-01. `NetworkAdapter.comment()`;
   the worker posts `posts.first_comment` right after the main post, best-effort
   (`post_targets.comment_external_id` / `comment_error`, migration 0017).
   **Bluesky proven live** (threaded reply). FB/IG need `pages_manage_engagement`
   / `instagram_manage_comments` — added to `META_SCOPES`, so **reconnect** FB/IG
   to pick them up. Threads written, unproven.
5. **Meta token refresh hardening** — ✅ built 2026-09-01. `refresh.ts` now
   re-derives the Page token from `me/accounts` after re-exchanging the user
   token (self-heals an invalidated Page token); records
   `social_accounts.token_error`, retries `status='error'` accounts
   (migrations 0017–0018). Surfaced on the Accounts page.

### P2 — depth (in progress, 2026-09-02)

**Done:**
- ✅ **Calendar:** filter by campaign / network / status; campaign colour-coding;
  key dates (election / filing / debate / fundraising / milestone anchors,
  migration 0019, managed per campaign in Settings)
- ✅ **Kill switch** — pause all publishing for a campaign; queued jobs held +
  resume on unpause (migration 0020), verified live
- ✅ **Team note per post** — operator-only, never shown to the candidate
  (migration 0021)
- ✅ **Review auto-nudge** — re-email the candidate if a post sits unapproved
  past `campaigns.review_nudge_hours` (migration 0022, `run-nudges` edge fn
  pinged by the worker every 30 min)

**Remaining:**
- **Approval:** inline comments on the caption/image (Planable-style),
  revision-round tracking UI.
- **Compose/schedule:** posting-time queue ("next slot"), recurring posts,
  thread/carousel composer, link shortener + UTM builder, saved
  caption/hashtag snippets, emoji picker.
- **Calendar:** Google Calendar / iCal feed.
- **Analytics:** nightly metric snapshots → time series, plain-language campaign
  recap, top/bottom posts (top done), scheduled report emails, shareable live
  report link.
- **Compliance (*ours*):** boost/paid-spend log for FEC, source-required posts
  (block approval until a source is attached), fundraising post type + goal
  thermometer + ActBlue/WinRed attribution.
- **Content sourcing:** RSS → drafts, evergreen recycling, bulk CSV upload,
  draft-from-a-link, request kanban (the spreadsheet's Short-notice /
  Media-missing / Need-approval columns).
- **Media:** media library, per-network aspect-ratio crop (Kibo `image-crop`
  vendored, unused), video passthrough, alt-text fields for all networks.
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
