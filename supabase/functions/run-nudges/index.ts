// POST /functions/v1/run-nudges   (x-trigger-secret: <WORKER_TRIGGER_SECRET>)
//
// Called by the worker on a slow cadence. For every post still waiting on the
// candidate past its campaign's nudge window, re-emails the candidate their
// portal link. Stamps posts.review_reminded_at so it nudges at most once per
// window.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, jsonResponse as json } from '../_shared/cors.ts';
import { appUrl, emailShell, escapeHtml, sendEmail } from '../_shared/email.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const expected = Deno.env.get('WORKER_TRIGGER_SECRET');
  if (expected && req.headers.get('x-trigger-secret') !== expected) {
    return json({ error: 'forbidden' }, 403);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data: posts } = await admin
    .from('posts')
    .select(
      'id, body, review_reminded_at, campaign:campaigns!inner(id, name, approver_name, approver_email, review_token, review_nudge_hours)',
    )
    .eq('approval_state', 'pending')
    .gt('campaign.review_nudge_hours', 0);

  let nudged = 0;
  for (const p of posts ?? []) {
    const c = p.campaign as {
      name: string;
      approver_name: string | null;
      approver_email: string | null;
      review_token: string | null;
      review_nudge_hours: number;
    };
    if (!c.approver_email || !c.review_token) continue;

    const windowMs = c.review_nudge_hours * 3_600_000;

    // don't nudge again inside the window
    if (p.review_reminded_at && Date.now() - new Date(p.review_reminded_at).getTime() < windowMs) {
      continue;
    }

    // only after it's actually been sitting there a full window — measured from
    // the last "sent for review" event
    const { data: ev } = await admin
      .from('approval_events')
      .select('created_at')
      .eq('post_id', p.id)
      .eq('event', 'sent_for_review')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ev || Date.now() - new Date(ev.created_at).getTime() < windowMs) continue;

    const first = c.approver_name?.trim().split(/\s+/)[0];
    const excerpt = (p.body ?? '').split('\n')[0]?.slice(0, 200) ?? '';
    await sendEmail({
      to: c.approver_email,
      replyTo: null,
      subject: `Still waiting on your review — ${c.name}`,
      html: emailShell(
        `<p>${first ? `Hi ${escapeHtml(first)},` : 'Hi,'}</p>
         <p>A post for <strong>${escapeHtml(c.name)}</strong> has been waiting for your review for
         over ${c.review_nudge_hours} hour${c.review_nudge_hours === 1 ? '' : 's'}.</p>
         ${excerpt ? `<p style="border-left:2px solid #d9d3c4;padding-left:12px;color:#6b6a5e">${escapeHtml(excerpt)}</p>` : ''}`,
        { label: 'Review posts', href: appUrl(`/review/${c.review_token}`) },
      ),
    });
    await admin.from('posts').update({ review_reminded_at: new Date().toISOString() }).eq('id', p.id);
    nudged++;
  }

  return json({ ok: true, checked: posts?.length ?? 0, nudged });
});
