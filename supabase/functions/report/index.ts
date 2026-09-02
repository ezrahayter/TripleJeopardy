// Shareable live campaign report.
//
// GET  /functions/v1/report?token=<campaigns.report_token>
//        -> { campaign, generatedAt, recap, recapAt, stats, trend, top }
// POST /functions/v1/report  { action, campaign_id }         (operator JWT)
//        action 'setup'  -> { token }          mint the link if missing
//        action 'revoke' -> { ok }             drop the link
//        action 'recap'  -> { recap, recapAt } regenerate the summary (needs key)

import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, jsonResponse as json } from '../_shared/cors.ts';

type Metrics = Record<string, number>;

const ENGAGE = ['likes', 'like_count', 'comments', 'comments_count', 'replies', 'reposts', 'shares', 'quotes', 'saved'];
const REACH = ['impressions', 'reach', 'views', 'post_impressions', 'post_impressions_unique'];

const sum = (m: Metrics, keys: string[]) => keys.reduce((s, k) => s + (Number(m?.[k]) || 0), 0);
const engagementOf = (m: Metrics) => sum(m, ENGAGE);
const reachOf = (m: Metrics) => sum(m, REACH);

async function loadReport(admin: ReturnType<typeof createClient>, campaign: Record<string, unknown>) {
  const { data: targets } = await admin
    .from('post_targets')
    .select('id, published_at, external_url, metrics, social_account:social_accounts(network), post:posts!inner(body, campaign_id)')
    .eq('status', 'published')
    .eq('post.campaign_id', campaign.id as string)
    .order('published_at', { ascending: false });

  const rows = ((targets ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    published_at: r.published_at as string | null,
    external_url: r.external_url as string | null,
    network: (r.social_account as { network?: string } | null)?.network ?? 'unknown',
    body: ((r.post as { body?: string } | null)?.body ?? '').slice(0, 240),
    metrics: (r.metrics ?? {}) as Metrics,
  }));

  const now = Date.now();
  const d30 = now - 30 * 864e5;
  const byNetwork: Record<string, number> = {};
  for (const r of rows) byNetwork[r.network] = (byNetwork[r.network] ?? 0) + 1;

  const stats = {
    published: rows.length,
    last30: rows.filter((r) => r.published_at && new Date(r.published_at).getTime() >= d30).length,
    engagement: rows.reduce((s, r) => s + engagementOf(r.metrics), 0),
    reach: rows.reduce((s, r) => s + reachOf(r.metrics), 0),
    byNetwork,
  };

  const top = [...rows]
    .sort((a, b) => engagementOf(b.metrics) - engagementOf(a.metrics))
    .slice(0, 5)
    .map((r) => ({
      body: r.body,
      network: r.network,
      url: r.external_url,
      engagement: engagementOf(r.metrics),
      reach: reachOf(r.metrics),
      published_at: r.published_at,
    }));

  const since = new Date(now - 44 * 864e5).toISOString().slice(0, 10);
  const ids = rows.map((r) => r.id);
  let trend: { day: string; engagement: number; reach: number }[] = [];
  if (ids.length) {
    const { data: snaps } = await admin
      .from('metric_snapshots')
      .select('captured_on, metrics')
      .in('post_target_id', ids)
      .gte('captured_on', since)
      .order('captured_on');
    const byDay = new Map<string, { day: string; engagement: number; reach: number }>();
    for (const s of (snaps ?? []) as Array<{ captured_on: string; metrics: Metrics }>) {
      const day = byDay.get(s.captured_on) ?? { day: s.captured_on, engagement: 0, reach: 0 };
      day.engagement += engagementOf(s.metrics ?? {});
      day.reach += reachOf(s.metrics ?? {});
      byDay.set(s.captured_on, day);
    }
    trend = [...byDay.values()];
  }

  return { stats, top, trend };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  try {
    if (req.method === 'GET') {
      const token = new URL(req.url).searchParams.get('token');
      if (!token) return json({ error: 'Missing token' }, 400);
      const { data: campaign } = await admin
        .from('campaigns')
        .select('id, name, report_recap, report_recap_at')
        .eq('report_token', token)
        .maybeSingle();
      if (!campaign) return json({ error: 'This report link is not valid.' }, 404);

      const { stats, top, trend } = await loadReport(admin, campaign);
      return json({
        campaign: campaign.name,
        generatedAt: new Date().toISOString(),
        recap: campaign.report_recap ?? null,
        recapAt: campaign.report_recap_at ?? null,
        stats,
        top,
        trend,
      });
    }

    if (req.method === 'POST') {
      const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
      if (!jwt) return json({ error: 'Missing bearer token' }, 401);
      const { data: u } = await admin.auth.getUser(jwt);
      if (!u.user) return json({ error: 'Invalid session' }, 401);

      const { action, campaign_id } = await req.json();
      if (!campaign_id) return json({ error: 'campaign_id required' }, 400);

      // membership check via RLS: read the campaign as the caller
      const asUser = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } },
      );
      const { data: campaign } = await asUser
        .from('campaigns')
        .select('id, name, report_token')
        .eq('id', campaign_id)
        .maybeSingle();
      if (!campaign) return json({ error: 'Not found' }, 404);

      if (action === 'setup') {
        let token = campaign.report_token as string | null;
        if (!token) {
          token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
          await admin.from('campaigns').update({ report_token: token }).eq('id', campaign_id);
        }
        return json({ token });
      }

      if (action === 'revoke') {
        await admin
          .from('campaigns')
          .update({ report_token: null, report_recap: null, report_recap_at: null })
          .eq('id', campaign_id);
        return json({ ok: true });
      }

      if (action === 'recap') {
        const key = Deno.env.get('ANTHROPIC_API_KEY');
        if (!key) return json({ error: 'AI is not configured yet.' }, 503);
        const { stats, top } = await loadReport(admin, campaign);
        const digest =
          `Campaign: ${campaign.name}\n` +
          `Published posts: ${stats.published} (last 30 days: ${stats.last30})\n` +
          `Total engagement: ${stats.engagement}\nTotal reach: ${stats.reach}\n` +
          `By network: ${Object.entries(stats.byNetwork).map(([n, c]) => `${n} ${c}`).join(', ') || 'none'}\n` +
          `Top posts:\n${top.map((t, i) => `${i + 1}. [${t.network}, ${t.engagement} eng] ${t.body}`).join('\n')}`;

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-opus-5',
            max_tokens: 700,
            output_config: { effort: 'low' },
            system:
              'You brief a political campaign on how their social feeds are doing. ' +
              'Three short paragraphs, plain and direct, no hype, no em-dashes. ' +
              'What is working, what is not, one concrete suggestion. Use the numbers given; do not invent any.',
            messages: [{ role: 'user', content: digest }],
          }),
        });
        const data = await res.json();
        if (!res.ok) return json({ error: data?.error?.message ?? 'AI request failed' }, 502);
        const recap: string =
          (data.content ?? []).find((b: { type?: string }) => b.type === 'text')?.text?.trim() ?? '';
        const recapAt = new Date().toISOString();
        await admin
          .from('campaigns')
          .update({ report_recap: recap, report_recap_at: recapAt })
          .eq('id', campaign_id);
        return json({ recap, recapAt });
      }

      return json({ error: 'Unknown action' }, 400);
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 400);
  }
});
