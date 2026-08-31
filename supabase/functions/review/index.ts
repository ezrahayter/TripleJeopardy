// GET  /functions/v1/review?token=xxx        -> the post to review (no login)
// POST /functions/v1/review  {token, decision, note}
//
// The reviewer (candidate / designee) never signs in. The token is the auth.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, jsonResponse as json } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  try {
    const url = new URL(req.url);
    const token =
      req.method === 'GET' ? url.searchParams.get('token') : (await req.clone().json()).token;
    if (!token) return json({ error: 'Missing token' }, 400);

    const { data: link } = await admin
      .from('review_links')
      .select('token, post_id, campaign_id, expires_at, decided_at, decision')
      .eq('token', token)
      .maybeSingle();
    if (!link) return json({ error: 'This review link is not valid.' }, 404);
    if (new Date(link.expires_at) < new Date()) {
      return json({ error: 'This review link has expired.' }, 410);
    }

    const { data: campaign } = await admin
      .from('campaigns')
      .select('name, approver_name')
      .eq('id', link.campaign_id)
      .single();
    const { data: post } = await admin
      .from('posts')
      .select('id, body, status, approval_state')
      .eq('id', link.post_id)
      .single();
    if (!post) return json({ error: 'The post no longer exists.' }, 404);

    // media -> signed URLs
    const { data: mediaRows } = await admin
      .from('post_media')
      .select('storage_path')
      .eq('post_id', post.id)
      .order('sort');
    const paths = (mediaRows ?? []).map((m) => m.storage_path as string);
    let media: string[] = [];
    if (paths.length) {
      const { data: signed } = await admin.storage.from('media').createSignedUrls(paths, 3600);
      media = (signed ?? []).map((s) => s.signedUrl).filter(Boolean) as string[];
    }

    const payload = {
      campaign: campaign?.name ?? 'this campaign',
      reviewer: campaign?.approver_name ?? null,
      body: post.body ?? '',
      media,
      decided: Boolean(link.decided_at),
      decision: link.decision as string | null,
    };

    if (req.method === 'GET') return json(payload);

    if (req.method === 'POST') {
      if (link.decided_at) return json({ error: 'A decision was already recorded.', ...payload }, 409);
      const { decision, note } = await req.json();
      if (decision !== 'approved' && decision !== 'changes_requested') {
        return json({ error: "decision must be 'approved' or 'changes_requested'" }, 400);
      }

      await admin
        .from('review_links')
        .update({ decided_at: new Date().toISOString(), decision })
        .eq('token', token);

      await admin
        .from('posts')
        .update({ approval_state: decision === 'approved' ? 'approved' : 'changes_requested' })
        .eq('id', post.id);

      await admin.from('approval_events').insert({
        post_id: post.id,
        event: decision,
        actor: campaign?.approver_name || 'reviewer',
        note: typeof note === 'string' ? note.slice(0, 2000) : null,
      });

      return json({ ok: true, decision });
    }

    return json({ error: 'GET or POST only' }, 405);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 400);
  }
});
