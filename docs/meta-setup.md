# Connecting Facebook / Instagram / Threads

Meta App Review (weeks) only gates use by the **general public**. An app in
**Development mode** works fully for anyone with a **Tester** role. So: add each
candidate as a tester now, run App Review in parallel for later.

Redirect URI used everywhere below:
```
https://zompyktytkwyueedshzk.supabase.co/functions/v1/oauth-callback
```

---

## Part A — Configure the app (once)

At **developers.facebook.com → My Apps → [your app]**:

### 1. App settings → Basic
- **Show** the **App Secret**. Copy the **App ID** and **App Secret**.
- **App Domains**: `zompyktytkwyueedshzk.supabase.co` (add your Pages domain too if you get one)
- **Privacy Policy URL**: required. Host a privacy policy page somewhere public and
  put its URL here. (A Notion page, a Pages route, anything reachable.)
- **Category**: "Business and Pages" or similar.

### 2. Facebook Login for Business → Settings (left sidebar)
- **Valid OAuth Redirect URIs**: add the redirect URI above.
- **Client OAuth Login**: On. **Web OAuth Login**: On.

### 3. Use case: "Authenticate and request data… with Facebook Login" → Customize
Request these permissions (they show as **Standard Access** — fine for testers):
- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`
- `business_management`
- `instagram_basic`
- `instagram_content_publish`

### 4. Add the Threads use case
- Use cases → **Add use case → "Access the Threads API"**
- In its **Settings**, add the same redirect URI.
- Request `threads_basic`, `threads_content_publish`.

### 5. Put the credentials into Triple Jeopardy
```bash
# Supabase (for the oauth-start / oauth-callback functions)
cd triple-jeopardy
npx supabase secrets set META_APP_ID="..." META_APP_SECRET="..." PUBLIC_APP_URL="https://triple-jeopardy.pages.dev"
npx supabase functions deploy oauth-start
npx supabase functions deploy oauth-callback

# Cloudflare worker (for the nightly Meta token-refresh sweep)
cd worker
npx wrangler secret put META_APP_ID
npx wrangler secret put META_APP_SECRET
npx wrangler deploy
```

---

## Part B — Add a tester (per candidate)

The candidate must already be an **admin of the Facebook Page**, and their
**Instagram account must be Business or Creator** and **linked to that Page**
(Page Settings → Linked accounts, or the IG app → Settings → *Switch to
professional account* if it's still personal).

1. Meta app → **App Roles → Roles**
2. Scroll to **Testers** → **Add Testers**
3. Enter their **Facebook username** or the **email on their Facebook account**
4. They accept: a notification appears, or **facebook.com/settings → Business
   Integrations** → accept the invite. Two minutes, one time.
5. Now they can run the **Connect Facebook / Instagram** flow in Triple Jeopardy
   (Accounts tab) and it will work — no App Review.

Threads: check whether the Threads use case has its own tester list in its
Settings. Usually the app-tester role covers it; add them there too if prompted.

---

## Part C — Business verification (start now, runs for days–weeks)

Needed for going live (Advanced Access), higher rate limits, some features.
Not needed for tester publishing, but the clock is long so start it.

1. **business.facebook.com** — create a **Business Portfolio** for Positive Force
   if you don't have one.
2. Meta app → **App settings → Basic → Business Portfolio** → select it.
3. **business.facebook.com → Business Settings → Security Center** →
   **Start Verification**.
4. Provide legal business name, address, phone, and a verification document —
   business registration, business license, a utility bill, tax document, or
   bank statement showing the business name + address. Sole proprietor: a
   government-issued business doc works.
5. Meta reviews — usually a few days.

---

## Part D — App Review (only when onboarding non-tester clients)

Meta app → **App Review → Permissions and Features** → request **Advanced
Access** for each permission. You'll need:
- a screencast of the full flow (log in → connect a Page → schedule → publish)
- the hosted privacy policy
- business verification complete

Review takes ~1–4 weeks.

---

## Gotchas

- **Instagram won't appear** if the IG account is personal, or not linked to a
  Page the candidate admins.
- **`pages_manage_posts` missing** → re-run the connect flow; the candidate must
  tick the Page checkbox in Meta's authorize dialog.
- Meta long-lived tokens last ~60 days. The worker's nightly sweep refreshes
  them; if a candidate's connection goes stale, reconnect from the Accounts tab.
- The `oauth-callback` and `review` functions are `verify_jwt = false` — that's
  intentional (Meta and reviewers hit them with no Supabase session).
