// POST /functions/v1/notify-candidate  { post_id }   (operator JWT)
//
// Emails the campaign's candidate / designated approver that a post is waiting
// for their review, with the stable portal link. Called by the "Send for
// review" action. No-ops quietly if the campaign has no approver email or
// notifications aren't configured.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, jsonResponse as json } from '../_shared/cors.ts';
import { appUrl, emailShell, escapeHtml, sendEmail } from '../_shared/email.ts';

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

    const { data: userData, error: uErr } = await admin.auth.getUser(jwt);
    if (uErr || !userData.user) return json({ error: 'Invalid session' }, 401);

    const { post_id } = await req.json();
    const { data: post } = await admin
      .from('posts')
      .select(
        'id, body, campaign:campaigns(id, org_id, name, approver_name, approver_email, review_token, org:orgs(notify_email))',
      )
      .eq('id', post_id)
      .maybeSingle();
    const c = post?.campaign as
      | {
          id: string;
          org_id: string;
          name: string;
          approver_name: string | null;
          approver_email: string | null;
          review_token: string | null;
          org: { notify_email: string | null } | null;
        }
      | null;
    if (!post || !c) return json({ error: 'Post not found' }, 404);

    const { data: mem } = await admin
      .from('memberships')
      .select('id')
      .eq('org_id', c.org_id)
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (!mem) return json({ error: 'Not a member of this workspace' }, 403);

    if (!c.approver_email) return json({ ok: false, reason: 'no approver email on the campaign' });
    if (!c.review_token) return json({ ok: false, reason: 'no review token' });

    const { count } = await admin
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', c.id)
      .eq('approval_state', 'pending');

    const first = c.approver_name?.trim().split(/\s+/)[0];
    const excerpt = (post.body ?? '').split('\n')[0]?.slice(0, 200) ?? '';

    await sendEmail({
      to: c.approver_email,
      replyTo: c.org?.notify_email ?? null, // candidate's reply goes to the team
      subject: `A post is ready for your review — ${c.name}`,
      html: emailShell(
        `<p>${first ? `Hi ${escapeHtml(first)},` : 'Hi,'}</p>
         <p>A post for <strong>${escapeHtml(c.name)}</strong> is ready for your review${
           count && count > 1 ? ` — ${count} waiting` : ''
         }.</p>
         ${
           excerpt
             ? `<p style="border-left:2px solid #d9d3c4;padding-left:12px;color:#6b6a5e">${escapeHtml(excerpt)}</p>`
             : ''
         }
         <p style="color:#6b6a5e">This link is the same every time — bookmark it and check back whenever there's something new.</p>`,
        { label: 'Review posts', href: appUrl(`/review/${c.review_token}`) },
      ),
    });

    return json({ ok: true });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 400);
  }
});
