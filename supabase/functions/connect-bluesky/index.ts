// POST /functions/v1/connect-bluesky
// body: { campaign_id, handle, app_password, service_url? }
//
// Verifies the caller is a workspace member, confirms the Bluesky app password
// works, encrypts it, and stores the account. The encryption key never leaves
// the server.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { encryptSecret } from '../_shared/crypto.ts';
import { cors, jsonResponse as json } from '../_shared/cors.ts';

interface Session {
  did: string;
  handle: string;
}

async function verifyBluesky(serviceUrl: string, identifier: string, password: string): Promise<Session> {
  const res = await fetch(new URL('/xrpc/com.atproto.server.createSession', serviceUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: identifier.replace(/^@/, ''), password }),
  });
  if (!res.ok) {
    throw new Error(`Bluesky rejected those credentials (${res.status}).`);
  }
  const body = (await res.json()) as Session;
  return { did: body.did, handle: body.handle };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (!jwt) return json({ error: 'Missing bearer token' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const encryptionKey = Deno.env.get('TJ_ENCRYPTION_KEY');
    if (!encryptionKey) return json({ error: 'TJ_ENCRYPTION_KEY is not set on the function' }, 500);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData.user) return json({ error: 'Invalid session' }, 401);
    const userId = userData.user.id;

    const { campaign_id, handle, app_password, service_url } = await req.json();
    if (!campaign_id || !handle || !app_password) {
      return json({ error: 'campaign_id, handle and app_password are required' }, 400);
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
      .eq('user_id', userId)
      .maybeSingle();
    if (!membership) return json({ error: 'Not a member of this workspace' }, 403);

    const serviceUrl = (service_url as string | undefined)?.trim() || 'https://bsky.social';
    const identity = await verifyBluesky(serviceUrl, handle, app_password);
    const secret_ciphertext = await encryptSecret(app_password, encryptionKey);

    const { data: account, error: insErr } = await admin
      .from('social_accounts')
      .insert({
        org_id: campaign.org_id,
        campaign_id,
        network: 'bluesky',
        handle: identity.handle,
        external_id: identity.did,
        service_url: serviceUrl,
        secret_ciphertext,
        status: 'active',
      })
      .select('id, handle, external_id, network, account_type, service_url, status, created_at')
      .single();
    if (insErr) throw insErr;

    return json({ account });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 400);
  }
});
