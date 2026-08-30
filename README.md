# Triple Jeopardy — Phase 0 skeleton

A social publishing tool for the freelancer who runs a political candidate's feed.
A **Positive Force FL** tool. Named for the Third World Women's Alliance newspaper (1971).

**Phase 0 goal:** prove the whole pipeline end to end on one network with no
approval gate yet — compose → schedule → a worker publishes it within the target
minute → status comes back. Network: **Bluesky** (no platform review to wait on).

```
triple-jeopardy/
├── shared/      NetworkAdapter interface + BlueskyAdapter + AES-GCM crypto + domain types
├── supabase/    Postgres schema, RLS, the job queue, and the connect-bluesky Edge Function
├── worker/      Cloudflare Worker — the cron publisher (job queue = a Postgres table)
└── web/         Vite + React + TS app, built on the Positive Force FL tokens
```

Everything here runs on free tiers. The only real cost later is a domain.

---

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. **SQL Editor → New query** → run each file in `supabase/migrations/` in order
   (`0001` … `0004`). Or, with the [Supabase CLI](https://supabase.com/docs/guides/cli):
   ```bash
   supabase link --project-ref YOUR_REF
   supabase db push
   ```
3. **Project Settings → API** — copy the **Project URL**, the **anon** key, and the
   **service_role** key.
4. Generate an encryption key (used to encrypt stored Bluesky app passwords):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
5. Deploy the Edge Function and give it secrets:
   ```bash
   supabase functions deploy connect-bluesky
   supabase secrets set TJ_ENCRYPTION_KEY="<the key from step 4>"
   # SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically
   ```
   > If the deploy complains about `npm:@supabase/supabase-js@2`, swap that import
   > in `supabase/functions/connect-bluesky/index.ts` for
   > `https://esm.sh/@supabase/supabase-js@2`.
6. **Authentication → Providers** — make sure Email is on. For local dev, the
   magic-link URL is printed to the Supabase logs (or use Inbucket at
   `localhost:54324` if running `supabase start`).

## 2. Install

```bash
npm run install:all
```

(installs `shared`, `web`, and `worker` — there is no root `node_modules`.)

## 3. Web app

```bash
cp web/.env.example web/.env      # fill in URL + anon key
npm run dev                       # http://localhost:5173
```

First sign-in walks you through creating a workspace + first campaign, then:
**Accounts** → connect a Bluesky account (use an
[app password](https://bsky.app/settings/app-passwords), not the real one) →
**Compose** → write a post → *Publish now* or schedule it.

## 4. Publisher worker

```bash
cp worker/.dev.vars.example worker/.dev.vars     # fill in all four values
cd worker && npm run dev
# trigger a run without waiting for cron:
curl -X POST localhost:8787/run -H "x-trigger-secret: <WORKER_TRIGGER_SECRET>"
```

Deploy:

```bash
cd worker
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put TJ_ENCRYPTION_KEY          # same key as the Edge Function
npx wrangler secret put WORKER_TRIGGER_SECRET      # optional
npm run deploy
```

The cron (`* * * * *` in `wrangler.toml`) then claims and publishes due jobs.

---

## How it fits together

```
web  ──insert post (draft)──────────────►  posts
web  ──update status = 'scheduled'──────►  posts
                                           │  trigger tj_enqueue_on_schedule
                                           ▼
                              post_targets + publish_jobs   (one job per target, ever)
                                           ▲
worker (cron, every minute)  ──tj_claim_publish_jobs (SKIP LOCKED)──┘
   │  decrypt credential, getAdapter(network).publish(...)
   ├─ success ─► tj_complete_job  ─► post_target 'published', post 'published' when all done
   └─ failure ─► tj_fail_job      ─► exponential backoff, or 'dead' after max_attempts
```

- **Idempotency:** `publish_jobs.idempotency_key = post_target_id`, unique. A post
  target can never be enqueued — or published — twice.
- **Tenancy:** every table carries `org_id` / `campaign_id`. RLS = "you see a row
  iff you're a member of its org." The worker and Edge Function use the service
  role and bypass RLS.
- **Secrets:** Bluesky app passwords are AES-256-GCM encrypted
  (`shared/src/crypto.ts`, mirrored into the Edge Function). The key lives only on
  the server.
- **Adapters:** `shared/src/adapters/` — `NetworkAdapter` is the only interface.
  Phase 1 adds `FacebookAdapter`, `InstagramAdapter`, `ThreadsAdapter` behind the
  same shape.

## Known Phase-0 shortcuts (tighten in Phase 1)

- `tj_enqueue_on_schedule` targets **every** active account on the campaign — no
  per-post target picking yet.
- Storage policies allow any signed-in user to read/write the `media` bucket;
  scope them to the caller's own campaigns.
- `secret_ciphertext` sits on `social_accounts` (members can read the ciphertext,
  not the key). Move to Supabase Vault or a no-select secrets table.
- No token-refresh sweep — Bluesky sessions are created fresh per publish, so
  Phase 0 doesn't need one.
- No retry cap alerting / dead-letter notification.
