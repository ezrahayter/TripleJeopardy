// The candidate's review portal — one stable link per campaign, no login.
//
// GET  /functions/v1/review?token=<campaign.review_token>
//        -> { campaign, reviewer, pending: [ {id, body, media, scheduled_at, note?} ], recent: [...] }
// POST /functions/v1/review  { token, post_id, decision, note }
//        -> { ok, pending: [...] }   (the decided post drops off the list)

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
    const bodyJson = req.method === 'POST' ? await req.clone().json().catch(() => ({})) : {};
    const token = req.method === 'GET' ? url.searchParams.get('token') : bodyJson.token;
    if (!token) return json({ error: 'Missing token' }, 400);

    const { data: campaign } = await admin
      .from('campaigns')
      .select('id, name, approver_name, waived_networks')
      .eq('review_token', token)
      .maybeSingle();
    if (!campaign) return json({ error: 'This review link is not valid.' }, 404);

    async function withMedia(posts: { id: string; body: string; scheduled_at: string | null }[]) {
      const out = [];
      for (const p of posts) {
        const { data: mediaRows } = await admin
          .from('post_media')
          .select('storage_path')
          .eq('post_id', p.id)
          .order('sort');
        const paths = (mediaRows ?? []).map((m) => m.storage_path as string);
        let media: string[] = [];
        if (paths.length) {
          const { data: signed } = await admin.storage.from('media').createSignedUrls(paths, 3600);
          media = (signed ?? []).map((s) => s.signedUrl).filter(Boolean) as string[];
        }
        // the operator's most recent "changes requested" note, so the candidate
        // sees what they asked for last round
        const { data: ev } = await admin
          .from('approval_events')
          .select('note')
          .eq('post_id', p.id)
          .eq('event', 'changes_requested')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        out.push({ ...p, media, lastNote: ev?.note ?? null });
      }
      return out;
    }

    async function loadPending() {
      const { data } = await admin
        .from('posts')
        .select('id, body, scheduled_at')
        .eq('campaign_id', campaign.id)
        .eq('approval_state', 'pending')
        .order('scheduled_at', { nullsFirst: false });
      return withMedia((data ?? []) as never);
    }

    async function loadRecent() {
      const { data } = await admin
        .from('approval_events')
        .select('event, note, created_at, post:posts!inner(body, campaign_id)')
        .eq('post.campaign_id', campaign.id)
        .in('event', ['approved', 'changes_requested'])
        .order('created_at', { ascending: false })
        .limit(8);
      return (data ?? []).map((r: Record<string, unknown>) => ({
        event: r.event,
        note: r.note,
        created_at: r.created_at,
        body: (r.post as { body?: string })?.body ?? '',
      }));
    }

    if (req.method === 'GET') {
      return json({
        campaign: campaign.name,
        reviewer: campaign.approver_name ?? null,
        pending: await loadPending(),
        recent: await loadRecent(),
      });
    }

    if (req.method === 'POST') {
      const { post_id, decision, note } = bodyJson;
      if (decision !== 'approved' && decision !== 'changes_requested') {
        return json({ error: "decision must be 'approved' or 'changes_requested'" }, 400);
      }
      const { data: post } = await admin
        .from('posts')
        .select('id, approval_state')
        .eq('id', post_id)
        .eq('campaign_id', campaign.id)
        .maybeSingle();
      if (!post) return json({ error: 'That post is not part of this campaign.' }, 404);
      if (post.approval_state !== 'pending') {
        return json({ error: 'That post is no longer waiting for review.', pending: await loadPending() }, 409);
      }

      await admin
        .from('posts')
        .update({ approval_state: decision === 'approved' ? 'approved' : 'changes_requested' })
        .eq('id', post.id);

      await admin.from('approval_events').insert({
        post_id: post.id,
        event: decision,
        actor: campaign.approver_name || 'reviewer',
        note: typeof note === 'string' && note.trim() ? note.slice(0, 2000) : null,
      });

      return json({ ok: true, decision, pending: await loadPending() });
    }

    return json({ error: 'GET or POST only' }, 405);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 400);
  }
});
