# Triple Jeopardy — working notes for Claude

A social publishing tool for a freelance social manager who runs political
**candidates'** feeds. A **Positive Force FL** internal tool. The wedge is the
approval workflow: nothing posts until the campaign has signed off, and there's
a timestamped receipt. Named after the Third World Women's Alliance newspaper
(1971).

Full product scope: the "Triple Jeopardy" artifact
(https://claude.ai/code/artifact/83162b30-b9ef-46f3-a591-4f71674cfae3).

## Stack

- **web/** — Vite + React 18 + TS, on the Positive Force FL design tokens
  (`web/src/styles/tokens.css` — Bone ground, Chivo, single committed light
  theme). Magic-link auth, no router lib beyond react-router.
- **worker/** — one Cloudflare Worker, cron `* * * * *`. The publisher. Job
  queue is a Postgres table, not Redis. Claims with `FOR UPDATE SKIP LOCKED`.
- **shared/** — `NetworkAdapter` interface + adapters + AES-256-GCM crypto +
  domain types. Consumed by web (`@shared/*` alias) and worker (relative import).
  Edge Functions can't import it, so `supabase/functions/_shared/crypto.ts` is a
  hand-kept mirror.
- **supabase/** — Postgres + RLS ("member of the org or you don't see it"),
  Storage bucket `media`, Edge Functions. Project ref: `zompyktytkwyueedshzk`.

## Design rules that matter

- **Tenancy from line one.** Every table has `org_id` / `campaign_id`. RLS
  everywhere; worker + Edge Functions use the service role and bypass it.
- **Idempotency.** `publish_jobs.idempotency_key = post_target_id`, unique. A
  target is enqueued / published at most once, ever.
- **Adapter pattern is the only seam.** New network = new file in
  `shared/src/adapters/` + register in `index.ts` + widen the `network` check
  constraint + (for OAuth networks) an entry in the connect flow. Never branch
  network logic through the publisher.
- **Credentials encrypted at rest.** `TJ_ENCRYPTION_KEY` (base64 32 bytes) must
  be byte-identical across: Supabase Edge Function secrets, `worker/.dev.vars`,
  deployed worker secrets. Losing it = every connected account must reconnect.
- Follow the brand system in tokens.css. Per-campaign white-label (later) may
  override the logo + one accent, never the type or the Bone ground.

## Secrets (gitignored — recreate per machine)

- `web/.env` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (an
  `sb_publishable_...` key; supabase-js is 2.112+ which supports the new format)
- `worker/.dev.vars` — from `.dev.vars.example`

## Status (2026-08-31)

- ✅ Repo, Phase 0 + Phase 1 committed. `npm run typecheck`, `web` build, and
  `wrangler deploy --dry-run` all pass.
- ✅ Supabase project created; migrations **0001–0004 run**.
- ⬜ Migration **0005** (Phase 1 / Meta: network enum, token columns,
  `oauth_states`) — NOT run yet.
- ✅ `web/.env` set; `npm run dev` serves; login page renders clean.
- ⬜ `connect-bluesky` Edge Function not deployed; no account connected; no
  post published yet (Phase 0 not proven end-to-end).
- ⬜ `worker/.dev.vars` not created; worker never run.
- 🔄 Meta app being created (use case: "Authenticate ... with Facebook Login";
  add "Access the Threads API" as a second use case afterward). OAuth redirect
  URI to register: `https://zompyktytkwyueedshzk.supabase.co/functions/v1/oauth-callback`

## Phase 1 is scaffolded but UNVERIFIED

The Facebook / Instagram / Threads adapters and the `oauth-start` /
`oauth-callback` functions are written to Graph API v21.0 / Threads API v1.0
spec but have never run against a live Meta app. Expect to fix real details
(field names, container polling, permalink shapes) once the app is in dev mode
with a Tester account. Meta App Review Advanced Access is the gate for going
past testers.

## Next actions, in order

1. Deploy `connect-bluesky`, set `TJ_ENCRYPTION_KEY` secret, run the web app,
   connect a Bluesky account, publish a post via the worker — **prove Phase 0**.
2. Run migration `0005`.
3. Finish the Meta app, add yourself as Tester, set `META_APP_ID` /
   `META_APP_SECRET` on Supabase + worker, deploy `oauth-start` /
   `oauth-callback`, run the connect flow, fix what breaks.

## Roadmap (from the scope doc)

P0 Bluesky skeleton · **P1 Meta family** · P2 rapid response + fundraising +
campaign calendar + analytics + TikTok/YouTube · P3 multi-campaign + white-label
+ approval modes from the contract · P4 engagement + monitoring.

The contract-driven approval modes (candidate approves / designated approver /
waived per network) are Phase 1–3 product work, not yet in the code — the
skeleton has no approval gate.
