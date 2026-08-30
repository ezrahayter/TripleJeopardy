// POST /functions/v1/oauth-start
// body: { campaign_id, provider: 'meta' | 'threads', redirect_to? }
// -> { url }  (open it; the user authorizes; Meta redirects to oauth-callback)

import { createClient } from 'npm:@supabase/supabase-js@2';
import { metaAuthorizeUrl } from '../_shared/meta.ts';
import { threadsAuthorizeUrl } from '../_shared/threads.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (!jwt) return json({ error: 'Missing bearer token' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const appId = Deno.env.get('META_APP_ID');
    if (!appId) return json({ error: 'META_APP_ID is not configured' }, 500);

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData.user) return json({ error: 'Invalid session' }, 401);

    const { campaign_id, provider, redirect_to } = await req.json();
    if (provider !== 'meta' && provider !== 'threads') {
      return json({ error: "provider must be 'meta' or 'threads'" }, 400);
    }

    const { data: campaign } = await admin
      .from('campaigns')
      .select('id, org_id')
      .eq('id', campaign_id)
      .maybeSingle();
    if (!campaign) return json({ error: 'Campaign not found' }, 404);

    const { data: membership } = await admin
      .from('memberships')
      .select('id')
      .eq('org_id', campaign.org_id)
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (!membership) return json({ error: 'Not a member of this workspace' }, 403);

    const state = crypto.randomUUID();
    const { error: stateErr } = await admin.from('oauth_states').insert({
      state,
      provider,
      org_id: campaign.org_id,
      campaign_id,
      user_id: userData.user.id,
      redirect_to: redirect_to ?? null,
    });
    if (stateErr) throw stateErr;

    const redirectUri = `${supabaseUrl}/functions/v1/oauth-callback`;
    const url =
      provider === 'meta'
        ? metaAuthorizeUrl({ appId, redirectUri, state })
        : threadsAuthorizeUrl({ appId, redirectUri, state });

    return json({ url });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 400);
  }
});
