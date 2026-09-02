// POST /functions/v1/oauth-start
// body: { campaign_id, provider: 'meta' | 'threads', redirect_to? }
// -> { url }  (open it; the user authorizes; Meta redirects to oauth-callback)

import { createClient } from 'npm:@supabase/supabase-js@2';
import { metaAuthorizeUrl } from '../_shared/meta.ts';
import { threadsAuthorizeUrl } from '../_shared/threads.ts';
import { cors, jsonResponse as json } from '../_shared/cors.ts';

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

    const { campaign_id, org_id, provider, redirect_to } = await req.json();
    if (provider !== 'meta' && provider !== 'threads') {
      return json({ error: "provider must be 'meta' or 'threads'" }, 400);
    }
    // Threads returns a single account -> keep binding it to one campaign up
    // front. Meta returns every Page the operator manages -> connect at the org
    // level and assign Pages to campaigns after authorizing.
    if (provider === 'threads' && !campaign_id) {
      return json({ error: 'campaign_id is required for Threads' }, 400);
    }

    let resolvedOrgId = org_id as string | undefined;
    if (campaign_id) {
      const { data: campaign } = await admin
        .from('campaigns')
        .select('id, org_id')
        .eq('id', campaign_id)
        .maybeSingle();
      if (!campaign) return json({ error: 'Campaign not found' }, 404);
      resolvedOrgId = campaign.org_id;
    }
    if (!resolvedOrgId) return json({ error: 'campaign_id or org_id is required' }, 400);

    const { data: membership } = await admin
      .from('memberships')
      .select('id')
      .eq('org_id', resolvedOrgId)
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (!membership) return json({ error: 'Not a member of this workspace' }, 403);

    const state = crypto.randomUUID();
    const { error: stateErr } = await admin.from('oauth_states').insert({
      state,
      provider,
      org_id: resolvedOrgId,
      campaign_id: provider === 'threads' ? campaign_id : null,
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
