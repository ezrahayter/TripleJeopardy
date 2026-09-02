import { createClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from '../../shared/src/crypto';
import { graphGet } from '../../shared/src/adapters/meta-graph';
import type { Env } from './index';

// Keep Meta credentials alive before the ~60-day long-lived token lapses.
//
// facebook / instagram: re-exchange the stored long-lived *user* token for a
// fresh 60-day one, then re-derive the Page token from `me/accounts` and store
// it — so a Page token that was invalidated (password change, permission churn)
// self-heals on the next sweep.
// threads: refreshes its own token.

interface PageEntry {
  id: string;
  access_token: string;
  instagram_business_account?: { id: string };
}

export async function runTokenRefresh(env: Env): Promise<{ checked: number; refreshed: number }> {
  const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: accounts, error } = await supa.rpc('tj_accounts_needing_refresh');
  if (error) throw new Error(`refresh scan failed: ${error.message}`);

  const in60Days = () => new Date(Date.now() + 5_184_000_000).toISOString();
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
            status: 'active',
            token_error: null,
          })
          .eq('id', acct.id);
      } else {
        const userToken = await decryptSecret(acct.refresh_ciphertext, env.TJ_ENCRYPTION_KEY);
        const ex = await fetchJson(
          `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token` +
            `&client_id=${env.META_APP_ID}&client_secret=${env.META_APP_SECRET}` +
            `&fb_exchange_token=${userToken}`,
        );

        // re-derive this account's Page token against the fresh user token
        const pages = await graphGet<{ data?: PageEntry[] }>('me/accounts', {
          fields: 'id,access_token,instagram_business_account',
          access_token: ex.access_token,
        });
        let pageToken: string | undefined;
        for (const p of pages.data ?? []) {
          if (acct.network === 'facebook' && p.id === acct.external_id) pageToken = p.access_token;
          if (
            acct.network === 'instagram' &&
            p.instagram_business_account?.id === acct.external_id
          ) {
            pageToken = p.access_token;
          }
        }

        const update: Record<string, unknown> = {
          refresh_ciphertext: await encryptSecret(ex.access_token, env.TJ_ENCRYPTION_KEY),
          token_expires_at: ex.expires_in
            ? new Date(Date.now() + ex.expires_in * 1000).toISOString()
            : in60Days(),
          status: 'active',
          token_error: null,
        };
        if (pageToken) {
          update.secret_ciphertext = await encryptSecret(pageToken, env.TJ_ENCRYPTION_KEY);
        }
        await supa.from('social_accounts').update(update).eq('id', acct.id);
      }
      refreshed++;
    } catch (e) {
      const message = String((e as Error)?.message ?? e).slice(0, 500);
      await supa
        .from('social_accounts')
        .update({ status: 'error', token_error: message })
        .eq('id', acct.id);
      console.error(`token refresh failed for ${acct.id}:`, message);
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
