# Meta setup — step by step

Replace `APPID` in the links with your app's numeric ID once you have it
(it's in the dashboard URL: `developers.facebook.com/apps/APPID/...`).

Two values that go everywhere:
- Redirect URI: `https://zompyktytkwyueedshzk.supabase.co/functions/v1/oauth-callback`
- Privacy / data-deletion URL: `https://triple-jeopardy.pages.dev/privacy`

---

## Part 1 — Get a developer account (past the SMS wall)

1. Log into your personal account at <https://www.facebook.com>.
2. **Settings → Personal and account information → Contact info → Add mobile
   number.** Confirm the code. (This SMS path works even when the developer one
   doesn't.)
3. Go to <https://developers.facebook.com/> → **Get Started** (top right). With
   the phone already verified on the account it should skip the SMS and just ask
   you to accept the terms and pick "Developer."

If it still demands an SMS the number is probably VoIP / Google Voice / prepaid —
Meta blocks those. Use a postpaid carrier line.

Alternative: have a teammate with a working dev account create the app and add
you as an **Admin** (Part 5). The app doesn't have to be owned by your account.

## Part 2 — Create the app

Skip if you already have one.

1. <https://developers.facebook.com/apps/> → **Create app**
2. Use case: **Authenticate and request data from users with Facebook Login** → Next
3. Name `Triple Jeopardy`, contact `ezra@positiveforce.win`, business portfolio
   optional → **Create app** (re-enter your FB password)
4. Note the **App ID** — the number in the dashboard URL and on Basic Settings.

## Part 3 — Configure

**A. Basic settings** — `developers.facebook.com/apps/APPID/settings/basic/`
- Show the **App secret**; copy it and the **App ID**
- **App domains** → `zompyktytkwyueedshzk.supabase.co`
- **Privacy policy URL** → `https://triple-jeopardy.pages.dev/privacy`
- **User data deletion** → "Data deletion instructions URL" → same URL
- **Category** → Business and Pages
- **Save changes**

**B. Facebook Login settings** — `developers.facebook.com/apps/APPID/fb-login/settings/`
- **Valid OAuth Redirect URIs** → add the redirect URI
- Client OAuth Login: Yes · Web OAuth Login: Yes
- **Save changes**

**C. Threads** — `developers.facebook.com/apps/APPID/use_cases/`
- **Add use case → Access the Threads API**
- Its **Settings** → **Redirect Callback URLs** → add the redirect URI

**D. Permissions** — `developers.facebook.com/apps/APPID/app-review/permissions/`
- Confirm these show **Standard Access** (default — do NOT request Advanced yet):
  `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
  `business_management`, `instagram_basic`, `instagram_content_publish`

## Part 4 — Sandbox to test against (not the candidate's account)

1. <https://www.facebook.com/pages/create> → a junk Page ("TJ Sandbox").
2. A throwaway Instagram account → its Settings → **Switch to professional
   account → Business** → connect it to the TJ Sandbox Page.

Do all dev testing here. Connect the candidate's real Page/IG only at launch.

## Part 5 — Add a tester

`developers.facebook.com/apps/APPID/roles/roles/`
- **Testers → Add testers** → your Facebook username → Submit
- Accept: <https://www.facebook.com/settings?tab=business_tools>

## Part 6 — Wire into Triple Jeopardy

```bash
cd triple-jeopardy
npx supabase secrets set META_APP_ID="..." META_APP_SECRET="..." PUBLIC_APP_URL="https://triple-jeopardy.pages.dev"
npx supabase functions deploy oauth-start
npx supabase functions deploy oauth-callback

cd worker
npx wrangler secret put META_APP_ID
npx wrangler secret put META_APP_SECRET
npx wrangler deploy
```

Then: Accounts tab → **Connect Facebook / Instagram** → authorize → pick the
TJ Sandbox Page → it should land back connected.

## Part 7 — Business verification (start now, weeks-long)

Only needed for App Review / going public. <https://business.facebook.com> →
create a Business Portfolio → link it to the app (Basic settings) → **Security
Center → Start Verification** → submit business docs.

## Part 8 — App Review (only for non-tester clients, later)

`developers.facebook.com/apps/APPID/app-review/permissions/` → request Advanced
Access. Needs: a screencast of the full flow, the privacy policy, business
verification complete. ~1–4 weeks.

---

## Gotchas

- Instagram won't appear if the IG account is personal or not linked to a Page
  you admin.
- `pages_manage_posts` missing after connect → re-run the flow, tick the Page
  checkbox in Meta's dialog.
- Meta long-lived tokens last ~60 days; the worker's nightly sweep refreshes
  them. Stale connection → reconnect from the Accounts tab.
