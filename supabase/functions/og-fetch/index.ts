// GET /functions/v1/og-fetch?url=<url>
// Fetches a page and pulls its Open Graph title / description / image, so the
// composer can start a draft from a link.

import { cors, jsonResponse as json } from '../_shared/cors.ts';

function meta(html: string, ...names: string[]): string | undefined {
  for (const n of names) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${n}["'][^>]+content=["']([^"']+)["']`,
      'i',
    );
    const m = html.match(re) ?? html.match(
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${n}["']`, 'i'),
    );
    if (m?.[1]) return decode(m[1]);
  }
  return undefined;
}

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const target = new URL(req.url).searchParams.get('url');
    if (!target || !/^https?:\/\//i.test(target)) return json({ error: 'bad url' }, 400);

    const res = await fetch(target, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; TripleJeopardy/1.0)' },
      redirect: 'follow',
    });
    if (!res.ok) return json({ error: `source returned ${res.status}` }, 400);
    const html = (await res.text()).slice(0, 500_000);

    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
    return json({
      url: res.url,
      title: meta(html, 'og:title', 'twitter:title') ?? (titleTag ? decode(titleTag) : undefined),
      description: meta(html, 'og:description', 'twitter:description', 'description'),
      image: meta(html, 'og:image', 'twitter:image'),
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 400);
  }
});
