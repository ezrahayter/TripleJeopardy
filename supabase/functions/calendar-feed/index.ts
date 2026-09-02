// Read-only iCal feed for a campaign — the candidate (or the operator) can
// subscribe in Google / Apple Calendar and see every scheduled post and key
// date without logging in.
//
// GET /functions/v1/calendar-feed?token=<campaign.review_token>
//   -> text/calendar

import { createClient } from 'npm:@supabase/supabase-js@2';

const cal = {
  'content-type': 'text/calendar; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'cache-control': 'public, max-age=900',
};

function ics(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function stampUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function dateOnly(d: string): string {
  return d.replace(/-/g, '');
}

function fold(line: string): string {
  // RFC 5545: lines over 75 octets are folded with CRLF + a leading space
  if (line.length <= 73) return line;
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    chunks.push(rest.slice(0, 73));
    rest = ' ' + rest.slice(73);
  }
  chunks.push(rest);
  return chunks.join('\r\n');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const token = new URL(req.url).searchParams.get('token');
  if (!token) return new Response('Missing token', { status: 400 });

  const { data: campaign } = await admin
    .from('campaigns')
    .select('id, name, election_date')
    .eq('review_token', token)
    .maybeSingle();
  if (!campaign) return new Response('Not found', { status: 404 });

  const { data: posts } = await admin
    .from('posts')
    .select('id, body, scheduled_at, status')
    .eq('campaign_id', campaign.id)
    .not('scheduled_at', 'is', null)
    .in('status', ['scheduled', 'publishing', 'published'])
    .order('scheduled_at');

  const { data: dates } = await admin
    .from('campaign_dates')
    .select('id, label, date, kind')
    .eq('campaign_id', campaign.id)
    .order('date');

  const now = stampUtc(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Positive Force//Triple Jeopardy//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    fold(`X-WR-CALNAME:${ics(campaign.name)} — Triple Jeopardy`),
  ];

  for (const p of posts ?? []) {
    const start = new Date(p.scheduled_at as string);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const title = (p.body as string)?.split('\n')[0]?.trim().slice(0, 80) || 'Scheduled post';
    const label = p.status === 'published' ? 'Posted' : 'Scheduled';
    lines.push(
      'BEGIN:VEVENT',
      `UID:post-${p.id}@triple-jeopardy`,
      `DTSTAMP:${now}`,
      `DTSTART:${stampUtc(start)}`,
      `DTEND:${stampUtc(end)}`,
      fold(`SUMMARY:${ics(`${label}: ${title}`)}`),
      fold(`DESCRIPTION:${ics((p.body as string) ?? '')}`),
      'END:VEVENT',
    );
  }

  const anchors = [
    ...(campaign.election_date ? [{ label: 'Election Day', date: campaign.election_date as string }] : []),
    ...((dates ?? []).map((d) => ({ label: `${d.label}`, date: d.date as string }))),
  ];
  for (const a of anchors) {
    const next = new Date(a.date + 'T00:00:00Z');
    next.setUTCDate(next.getUTCDate() + 1);
    lines.push(
      'BEGIN:VEVENT',
      `UID:anchor-${a.date}-${ics(a.label).replace(/\s+/g, '')}@triple-jeopardy`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dateOnly(a.date)}`,
      `DTEND;VALUE=DATE:${dateOnly(next.toISOString().slice(0, 10))}`,
      fold(`SUMMARY:${ics(a.label)}`),
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return new Response(lines.join('\r\n') + '\r\n', { headers: cal });
});
