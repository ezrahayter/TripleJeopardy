// POST /functions/v1/connect-assign
// body: { pending_id, assignments: [{ external_id, campaign_id | null }] }
//
// Finishes a Meta connect: the operator has picked which campaign each granted
// Page / IG belongs to. Writes the chosen ones as social_accounts, drops the
// staging row. Skipped assets (no campaign_id) are just discarded.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, jsonResponse as json } from '../_shared/cors.ts';

interface StagedAsset {
  network: string;
  external_id: string;
  handle: string;
  meta: Record<string, unknown>;
  token_ciphertext: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (!jwt) return json({ error: 'Missing bearer token' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData.user) return json({ error: 'Invalid session' }, 401);
    const userId = userData.user.id;

    const { pending_id, assignments } = await req.json();
    if (!pending_id || !Array.isArray(assignments)) {
      return json({ error: 'pending_id and assignments[] are required' }, 400);
    }

    const { data: pending } = await admin
      .from('pending_connections')
      .select('*')
      .eq('id', pending_id)
      .maybeSingle();
    if (!pending) return json({ error: 'That connection has expired — reconnect.' }, 404);
    if (pending.user_id !== userId) return json({ error: 'Not your connection' }, 403);
    if (new Date(pending.expires_at) < new Date()) {
      await admin.from('pending_connections').delete().eq('id', pending_id);
      return json({ error: 'That connection has expired — reconnect.' }, 409);
    }

    const staged = (pending.assets ?? []) as StagedAsset[];
    // campaigns in this org, to validate the picks
    const { data: campaigns } = await admin
      .from('campaigns')
      .select('id')
      .eq('org_id', pending.org_id);
    const orgCampaigns = new Set((campaigns ?? []).map((c) => c.id as string));

    let connected = 0;
    for (const a of assignments as { external_id: string; campaign_id?: string | null }[]) {
      if (!a.campaign_id) continue;
      if (!orgCampaigns.has(a.campaign_id)) continue;
      const asset = staged.find((s) => s.external_id === a.external_id);
      if (!asset) continue;

      const { error: upErr } = await admin.from('social_accounts').upsert(
        {
          org_id: pending.org_id,
          campaign_id: a.campaign_id,
          network: asset.network,
          handle: asset.handle,
          external_id: asset.external_id,
          service_url: 'https://graph.facebook.com',
          secret_ciphertext: asset.token_ciphertext,
          refresh_ciphertext: pending.refresh_ciphertext,
          token_expires_at: pending.token_expires_at,
          meta: asset.meta,
          status: 'active',
        },
        { onConflict: 'campaign_id,network,external_id' },
      );
      if (upErr) return json({ error: upErr.message }, 400);
      connected++;
    }

    await admin.from('pending_connections').delete().eq('id', pending_id);
    return json({ ok: true, connected });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 400);
  }
});
