// GET /functions/v1/oauth-callback?code=...&state=...
// Meta redirects here after the user authorizes. Exchanges the code, stores the
// account(s), then 302s back to the app.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { encryptSecret } from '../_shared/crypto.ts';
import { metaExchangeCode, metaLongLived, metaListAssets } from '../_shared/meta.ts';
import {
  threadsExchangeCode,
  threadsLongLived,
  threadsProfile,
} from '../_shared/threads.ts';

function redirect(to: string, params: Record<string, string>): Response {
  const u = new URL(to);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { location: u.toString() } });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error_description') ?? url.searchParams.get('error');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const appUrl = Deno.env.get('PUBLIC_APP_URL') ?? 'http://localhost:5173';
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // resolve the handshake state -> where to send the user back
  let landing = appUrl;
  try {
    if (oauthError) throw new Error(oauthError);
    if (!code || !state) throw new Error('missing code or state');

    const { data: st } = await admin
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .maybeSingle();
    if (!st) throw new Error('unknown or expired state');
    await admin.from('oauth_states').delete().eq('state', state);
    if (new Date(st.expires_at) < new Date()) throw new Error('state expired');
    landing = st.redirect_to || `${appUrl}/accounts`;

    const appId = Deno.env.get('META_APP_ID')!;
    const appSecret = Deno.env.get('META_APP_SECRET')!;
    const encKey = Deno.env.get('TJ_ENCRYPTION_KEY')!;
    const redirectUri = `${supabaseUrl}/functions/v1/oauth-callback`;

    let connected = 0;
    let label = st.provider;

    if (st.provider === 'meta') {
      const short = await metaExchangeCode({ appId, appSecret, redirectUri, code });
      const long = await metaLongLived({ appId, appSecret, shortToken: short.access_token });
      const expiresAt = new Date(Date.now() + (long.expires_in ?? 5_184_000) * 1000).toISOString();
      const assets = await metaListAssets(long.access_token);
      if (assets.length === 0) throw new Error('no Pages granted - pick a Page in the Meta dialog');

      const refreshCipher = await encryptSecret(long.access_token, encKey);
      for (const a of assets) {
        await admin.from('social_accounts').upsert(
          {
            org_id: st.org_id,
            campaign_id: st.campaign_id,
            network: a.network,
            handle: a.handle,
            external_id: a.external_id,
            service_url: 'https://graph.facebook.com',
            secret_ciphertext: await encryptSecret(a.page_token, encKey),
            refresh_ciphertext: refreshCipher,
            token_expires_at: expiresAt,
            meta: a.meta,
            status: 'active',
          },
          { onConflict: 'campaign_id,network,external_id' },
        );
        connected++;
      }
      label = 'Facebook / Instagram';
    } else {
      const short = await threadsExchangeCode({ appId, appSecret, redirectUri, code });
      const long = await threadsLongLived({ appSecret, shortToken: short.access_token });
      const profile = await threadsProfile(long.access_token);
      const expiresAt = new Date(Date.now() + long.expires_in * 1000).toISOString();

      await admin.from('social_accounts').upsert(
        {
          org_id: st.org_id,
          campaign_id: st.campaign_id,
          network: 'threads',
          handle: profile.username,
          external_id: profile.id,
          service_url: 'https://graph.threads.net',
          secret_ciphertext: await encryptSecret(long.access_token, encKey),
          token_expires_at: expiresAt,
          meta: { threads_username: profile.username },
          status: 'active',
        },
        { onConflict: 'campaign_id,network,external_id' },
      );
      connected = 1;
      label = 'Threads';
    }

    return redirect(landing, { connected: label, count: String(connected) });
  } catch (e) {
    return redirect(landing.includes('/accounts') ? landing : `${appUrl}/accounts`, {
      connect_error: String((e as Error)?.message ?? e),
    });
  }
});
