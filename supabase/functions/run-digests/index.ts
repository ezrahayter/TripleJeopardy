// POST /functions/v1/run-digests   (x-trigger-secret: <WORKER_TRIGGER_SECRET>)
//
// Weekly. For each org with a notify_email and digest_enabled, emails a short
// summary of the last 7 days across its campaigns, with links to any live
// report pages. orgs.digest_sent_on guards against a same-day re-run.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, jsonResponse as json } from '../_shared/cors.ts';
import { appUrl, emailShell, escapeHtml, sendEmail } from '../_shared/email.ts';

type Metrics = Record<string, number>;
const ENGAGE = ['likes', 'like_count', 'comments', 'comments_count', 'replies', 'reposts', 'shares', 'quotes', 'saved'];
const eng = (m: Metrics) => ENGAGE.reduce((s, k) => s + (Number(m?.[k]) || 0), 0);

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

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  const { data: orgs } = await admin
    .from('orgs')
    .select('id, name, notify_email, digest_enabled, digest_sent_on');

  let sent = 0;
  for (const o of orgs ?? []) {
    if (!o.notify_email || o.digest_enabled === false || o.digest_sent_on === today) continue;

    const { data: campaigns } = await admin
      .from('campaigns')
      .select('id, name, report_token')
      .eq('org_id', o.id);
    if (!campaigns?.length) continue;

    const blocks: string[] = [];
    for (const c of campaigns) {
      const { data: published } = await admin
        .from('post_targets')
        .select('metrics, published_at, post:posts!inner(campaign_id)')
        .eq('status', 'published')
        .eq('post.campaign_id', c.id)
        .gte('published_at', weekAgo);

      const { count: scheduled } = await admin
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', c.id)
        .eq('status', 'scheduled');

      const rows = (published ?? []) as Array<{ metrics: Metrics }>;
      const engagement = rows.reduce((s, r) => s + eng(r.metrics ?? {}), 0);
      const reportLink = c.report_token
        ? ` · <a href="${appUrl(`/report/${c.report_token}`)}">full report</a>`
        : '';
      blocks.push(
        `<p style="margin:0 0 4px"><strong>${escapeHtml(c.name)}</strong>${reportLink}</p>
         <p style="margin:0 0 14px;color:#6b6a5e">${rows.length} posted this week ·
         ${engagement.toLocaleString()} interactions · ${scheduled ?? 0} scheduled ahead</p>`,
      );
    }

    await sendEmail({
      to: o.notify_email,
      subject: `This week on Triple Jeopardy`,
      html: emailShell(
        `<p>Here's the last seven days across your campaigns.</p>${blocks.join('')}`,
        { label: 'Open Triple Jeopardy', href: appUrl('/') },
      ),
    });
    await admin.from('orgs').update({ digest_sent_on: today }).eq('id', o.id);
    sent++;
  }

  return json({ ok: true, orgs: orgs?.length ?? 0, sent });
});
