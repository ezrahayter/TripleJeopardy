import { createClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from '../../shared/src/crypto';
import type { Env } from './index';

// Refresh Meta long-lived tokens before they lapse (~60-day life). FB Page
// tokens derived from a long-lived user token stay valid as long as the user
// token does, so re-exchanging the user token is enough for facebook/instagram.
// Threads refreshes its own token.

export async function runTokenRefresh(env: Env): Promise<{ checked: number; refreshed: number }> {
  const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: accounts, error } = await supa.rpc('tj_accounts_needing_refresh');
  if (error) throw new Error(`refresh scan failed: ${error.message}`);

  let refreshed = 0;
  for (const acct of (accounts ?? []) as Array<Record<string, any>>) {
    try {
      if (acct.network === 'threads') {
        const token = await decryptSecret(acct.secret_ciphertext, env.TJ_ENCRYPTION_KEY);
        const res = await fetchJson(
          `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${token}`,
        );
        await supa
          .from('social_accounts')
          .update({
            secret_ciphertext: await encryptSecret(res.access_token, env.TJ_ENCRYPTION_KEY),
            token_expires_at: new Date(
              Date.now() + (res.expires_in ?? 5_184_000) * 1000,
            ).toISOString(),
          })
          .eq('id', acct.id);
      } else {
        // facebook / instagram: re-exchange the stored long-lived user token
        const userToken = await decryptSecret(acct.refresh_ciphertext, env.TJ_ENCRYPTION_KEY);
        const res = await fetchJson(
          `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token` +
            `&client_id=${env.META_APP_ID}&client_secret=${env.META_APP_SECRET}` +
            `&fb_exchange_token=${userToken}`,
        );
        // page tokens keep working against the refreshed user token; just extend expiry
        await supa
          .from('social_accounts')
          .update({
            refresh_ciphertext: await encryptSecret(res.access_token, env.TJ_ENCRYPTION_KEY),
            token_expires_at: new Date(
              Date.now() + (res.expires_in ?? 5_184_000) * 1000,
            ).toISOString(),
          })
          .eq('id', acct.id);
      }
      refreshed++;
    } catch (e) {
      await supa
        .from('social_accounts')
        .update({ status: 'error' })
        .eq('id', acct.id);
      console.error(`token refresh failed for ${acct.id}:`, String((e as Error)?.message ?? e));
    }
  }

  return { checked: accounts?.length ?? 0, refreshed };
}

async function fetchJson(url: string): Promise<{ access_token: string; expires_in?: number }> {
  const res = await fetch(url);
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!res.ok || !json.access_token) {
    throw new Error(`${res.status}: ${json.error?.message ?? 'no access_token'}`);
  }
  return { access_token: json.access_token, expires_in: json.expires_in };
}
