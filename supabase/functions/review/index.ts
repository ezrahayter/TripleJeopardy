// The candidate's review portal — one stable link per campaign, no login.
//
// GET  /functions/v1/review?token=<campaign.review_token>
//        -> { campaign, reviewer, requestsEnabled, networks, pending: [...], recent: [...] }
// POST /functions/v1/review  { token, post_id, decision, note }          (approve / send back)
//        -> { ok, pending: [...] }
// POST /functions/v1/review  { token, action: 'sign-upload', request_id, filename, kind }
//        -> { path, token, signedUrl }   (client PUTs the file straight to signedUrl)
// POST /functions/v1/review  { token, action: 'request', request: {...}, media: [{path,kind}] }
//        -> { ok }

import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, jsonResponse as json } from '../_shared/cors.ts';
import { appUrl, emailShell, escapeHtml, sendEmail } from '../_shared/email.ts';

const TEXT_CAP = 4000;

function clampText(v: unknown, cap = TEXT_CAP): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, cap) : null;
}

function safeName(v: unknown): string {
  const base = typeof v === 'string' ? v : 'file';
  return (base.split('/').pop() ?? 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
}

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
      .select(
        'id, org_id, name, approver_name, approver_email, waived_networks, requests_enabled, org:orgs(notify_email)',
      )
      .eq('review_token', token)
      .maybeSingle();
    if (!campaign) return json({ error: 'This review link is not valid.' }, 404);

    const notifyEmail = (campaign.org as { notify_email?: string | null } | null)?.notify_email ?? null;
    // awaited so the send completes before the isolate is torn down; sendEmail
    // swallows its own errors, so this never breaks the candidate's action.
    async function notify(
      subject: string,
      bodyHtml: string,
      cta?: { label: string; href: string },
      replyTo?: string | null,
    ) {
      if (!notifyEmail) return;
      await sendEmail({ to: notifyEmail, replyTo, subject, html: emailShell(bodyHtml, cta) });
    }

    // the campaign's connected networks — the request wizard shows every
    // platform regardless, and marks these as auto-publishing
    async function connectedNetworks(): Promise<string[]> {
      const { data } = await admin
        .from('social_accounts')
        .select('network')
        .eq('campaign_id', campaign.id)
        .eq('status', 'active');
      return [...new Set((data ?? []).map((r) => r.network as string))];
    }

    async function withMedia(
      posts: { id: string; body: string; scheduled_at: string | null; thread_parts?: unknown }[],
    ) {
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
        const { data: comments } = await admin
          .from('post_comments')
          .select('author, author_name, body, resolved, created_at')
          .eq('post_id', p.id)
          .order('created_at');

        const threadParts = Array.isArray(p.thread_parts)
          ? (p.thread_parts as Array<{ body?: string }>).map((x) => x?.body ?? '').filter(Boolean)
          : [];
        out.push({
          ...p,
          media,
          threadParts,
          lastNote: ev?.note ?? null,
          comments: comments ?? [],
        });
      }
      return out;
    }

    async function loadPending() {
      const { data } = await admin
        .from('posts')
        .select('id, body, scheduled_at, thread_parts')
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

    async function loadScheduled() {
      const { data } = await admin
        .from('posts')
        .select('id, body, scheduled_at, status')
        .eq('campaign_id', campaign.id)
        .in('status', ['scheduled', 'publishing', 'published'])
        .not('scheduled_at', 'is', null)
        .gte('scheduled_at', new Date(Date.now() - 7 * 864e5).toISOString())
        .order('scheduled_at');
      return (data ?? []).map((p) => ({
        id: p.id as string,
        body: p.body as string,
        scheduled_at: p.scheduled_at as string,
        status: p.status as string,
      }));
    }

    if (req.method === 'GET') {
      return json({
        campaign: campaign.name,
        reviewer: campaign.approver_name ?? null,
        requestsEnabled: campaign.requests_enabled !== false,
        networks: await connectedNetworks(),
        pending: await loadPending(),
        scheduled: await loadScheduled(),
        recent: await loadRecent(),
      });
    }

    if (req.method === 'POST') {
      const action = bodyJson.action ?? 'decide';

      // ── candidate uploads a file for a request ──────────────────
      if (action === 'sign-upload') {
        const requestId = String(bodyJson.request_id ?? '');
        if (!/^[0-9a-f-]{36}$/i.test(requestId)) return json({ error: 'Bad request_id' }, 400);
        const kind = bodyJson.kind === 'resource' ? 'resource' : 'media';
        const path =
          `${campaign.id}/requests/${requestId}/${kind}-${crypto.randomUUID()}-${safeName(bodyJson.filename)}`;
        const { data, error } = await admin.storage.from('media').createSignedUploadUrl(path);
        if (error) return json({ error: error.message }, 400);
        return json({ path, token: data.token, signedUrl: data.signedUrl });
      }

      // ── candidate submits a post request ───────────────────────
      if (action === 'request') {
        if (campaign.requests_enabled === false) {
          return json({ error: 'This campaign is not taking requests right now.' }, 409);
        }
        const r = (bodyJson.request ?? {}) as Record<string, unknown>;
        const requestId = String(bodyJson.request_id ?? r.id ?? '');
        if (!/^[0-9a-f-]{36}$/i.test(requestId)) return json({ error: 'Bad request id' }, 400);

        const caption = clampText(r.caption);
        const exactWording = clampText(r.exact_wording);
        const notes = clampText(r.notes);
        if (!caption && !exactWording && !notes) {
          return json({ error: 'Add a caption, exact wording, or a note so we know what to make.' }, 400);
        }

        const kinds = Array.isArray(r.request_kinds)
          ? r.request_kinds.filter((x): x is string => typeof x === 'string').slice(0, 20)
          : [];
        const platforms = Array.isArray(r.platforms)
          ? r.platforms.filter((x): x is string => typeof x === 'string').slice(0, 20)
          : [];
        const photosVideo = ['have', 'coming_soon', 'none'].includes(r.photos_video as string)
          ? (r.photos_video as string)
          : null;
        const isDate = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

        const { error: insErr } = await admin.from('post_requests').insert({
          id: requestId,
          org_id: campaign.org_id,
          campaign_id: campaign.id,
          submitter_email: clampText(r.submitter_email, 320),
          request_kinds: kinds,
          content_type: clampText(r.content_type, 120),
          tied_to_event: r.tied_to_event === true,
          event_date: isDate(r.event_date),
          event_time: clampText(r.event_time, 120),
          event_location: clampText(r.event_location, 500),
          rsvp_link: clampText(r.rsvp_link, 1000),
          photos_video: photosVideo,
          exact_wording: exactWording,
          caption,
          reference: clampText(r.reference, 2000),
          notes,
          platforms,
          planned_publish: isDate(r.planned_publish),
          needs_submitter_approval: r.needs_submitter_approval === true,
          draft_lead: clampText(r.draft_lead, 120),
        });
        if (insErr) return json({ error: insErr.message }, 400);

        const media = Array.isArray(bodyJson.media) ? bodyJson.media.slice(0, 10) : [];
        const rows = media
          .filter((m: unknown): m is { path: string; kind?: string; filename?: string } =>
            !!m && typeof (m as { path?: unknown }).path === 'string' &&
            (m as { path: string }).path.startsWith(`${campaign.id}/requests/${requestId}/`))
          .map((m: { path: string; kind?: string; filename?: string }, i: number) => ({
            request_id: requestId,
            storage_path: m.path,
            filename: clampText(m.filename, 260),
            kind: m.kind === 'resource' ? 'resource' : 'media',
            sort: i,
          }));
        if (rows.length) {
          const { error: mErr } = await admin.from('post_request_media').insert(rows);
          if (mErr) return json({ error: mErr.message }, 400);
        }

        const submitter = clampText(r.submitter_email, 320);
        const summary = caption ?? exactWording ?? notes ?? '';
        await notify(
          `New post request — ${campaign.name}`,
          `<p>${escapeHtml(submitter ?? 'The candidate')} submitted a post request for <strong>${escapeHtml(campaign.name)}</strong>.</p>
           <p style="color:#6b6a5e">${escapeHtml([clampText(r.content_type, 120), kinds.join(', ')].filter(Boolean).join(' · '))}</p>
           ${summary ? `<p style="border-left:2px solid #d9d3c4;padding-left:12px;color:#6b6a5e">${escapeHtml(summary.slice(0, 300))}</p>` : ''}
           ${rows.length ? `<p style="color:#6b6a5e">${rows.length} file${rows.length > 1 ? 's' : ''} attached</p>` : ''}`,
          { label: 'Open the request', href: appUrl('/requests') },
          submitter, // reply goes straight to the candidate who asked
        );

        return json({ ok: true });
      }

      // ── candidate leaves a comment (not a decision) ───────────
      if (action === 'comment') {
        const body = clampText(bodyJson.body, 2000);
        if (!body) return json({ error: 'Write something first.' }, 400);
        const { data: p } = await admin
          .from('posts')
          .select('id')
          .eq('id', bodyJson.post_id)
          .eq('campaign_id', campaign.id)
          .maybeSingle();
        if (!p) return json({ error: 'That post is not part of this campaign.' }, 404);
        const { error } = await admin.from('post_comments').insert({
          org_id: campaign.org_id,
          post_id: p.id,
          author: 'reviewer',
          author_name: campaign.approver_name ?? null,
          body,
        });
        if (error) return json({ error: error.message }, 400);
        await notify(
          `New comment — ${campaign.name}`,
          `<p>${escapeHtml(campaign.approver_name || 'The reviewer')} left a comment on a post for
           <strong>${escapeHtml(campaign.name)}</strong>.</p>
           <p style="border-left:2px solid #d9d3c4;padding-left:12px;color:#6b6a5e">${escapeHtml(body)}</p>`,
          { label: 'Open in Approvals', href: appUrl('/approvals') },
          campaign.approver_email,
        );
        return json({ ok: true });
      }

      // ── approve / send back (unchanged) ────────────────────────
      const { post_id, decision, note } = bodyJson;
      if (decision !== 'approved' && decision !== 'changes_requested') {
        return json({ error: "decision must be 'approved' or 'changes_requested'" }, 400);
      }
      const { data: post } = await admin
        .from('posts')
        .select('id, approval_state, body')
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

      const cleanNote = typeof note === 'string' && note.trim() ? note.slice(0, 2000) : null;
      await admin.from('approval_events').insert({
        post_id: post.id,
        event: decision,
        actor: campaign.approver_name || 'reviewer',
        note: cleanNote,
      });

      const who = campaign.approver_name || 'The reviewer';
      const excerpt = (post.body ?? '').split('\n')[0]?.slice(0, 200) ?? '';
      if (decision === 'approved') {
        await notify(
          `Approved — ${campaign.name}`,
          `<p>${escapeHtml(who)} approved a post for <strong>${escapeHtml(campaign.name)}</strong>.</p>
           ${excerpt ? `<p style="border-left:2px solid #d9d3c4;padding-left:12px;color:#6b6a5e">${escapeHtml(excerpt)}</p>` : ''}
           <p style="color:#6b6a5e">It will publish on its scheduled date.</p>`,
          { label: 'View in Approvals', href: appUrl('/approvals') },
          campaign.approver_email, // reply goes to the candidate
        );
      } else {
        await notify(
          `Changes requested — ${campaign.name}`,
          `<p>${escapeHtml(who)} asked for changes on a post for <strong>${escapeHtml(campaign.name)}</strong>.</p>
           ${cleanNote ? `<p style="border-left:2px solid #ac4a2a;padding-left:12px">“${escapeHtml(cleanNote)}”</p>` : ''}
           ${excerpt ? `<p style="color:#6b6a5e">Post: ${escapeHtml(excerpt)}</p>` : ''}`,
          { label: 'Open in Approvals', href: appUrl('/approvals') },
          campaign.approver_email, // reply goes to the candidate
        );
      }

      return json({ ok: true, decision, pending: await loadPending() });
    }

    return json({ error: 'GET or POST only' }, 405);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 400);
  }
});
