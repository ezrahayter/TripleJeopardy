import { createClient } from '@supabase/supabase-js';
import type { Env } from './index';

// Poll each campaign's RSS/Atom feeds and turn new items into draft posts.
// Feeds checked at most every ~30 min; at most 3 new drafts per feed per run.

interface Feed {
  id: string;
  org_id: string;
  campaign_id: string;
  url: string;
  last_checked_at: string | null;
}

interface Item {
  guid: string;
  title: string;
  link: string;
}

const strip = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();

function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m && m[1] ? strip(m[1]) : undefined;
}

function parseFeed(xml: string): Item[] {
  const items: Item[] = [];
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/(item|entry)>/gi) ?? [];
  for (const b of blocks) {
    const title = tag(b, 'title') ?? '(untitled)';
    let link = tag(b, 'link');
    if (!link) {
      const href = b.match(/<link[^>]*href=["']([^"']+)["']/i);
      link = href?.[1];
    }
    const guid = tag(b, 'guid') ?? tag(b, 'id') ?? link ?? title;
    if (link) items.push({ guid: guid.slice(0, 500), title, link });
  }
  return items;
}

export async function runFeedSync(env: Env): Promise<{ feeds: number; drafted: number }> {
  const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const cutoff = new Date(Date.now() - 25 * 60 * 1000).toISOString();
  const { data: feeds } = await supa
    .from('campaign_feeds')
    .select('id, org_id, campaign_id, url, last_checked_at')
    .or(`last_checked_at.is.null,last_checked_at.lt.${cutoff}`)
    .limit(20);

  let drafted = 0;
  for (const f of (feeds ?? []) as Feed[]) {
    let error: string | null = null;
    try {
      const res = await fetch(f.url, {
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; TripleJeopardy/1.0)' },
      });
      if (!res.ok) throw new Error(`feed returned ${res.status}`);
      const items = parseFeed(await res.text()).slice(0, 10);

      const { data: seenRows } = await supa
        .from('feed_items_seen')
        .select('guid')
        .eq('feed_id', f.id);
      const seen = new Set((seenRows ?? []).map((r) => r.guid as string));

      const fresh = items.filter((i) => !seen.has(i.guid));
      // first sync: mark everything seen, draft nothing (avoids a flood)
      const toDraft = f.last_checked_at ? fresh.slice(0, 3) : [];

      for (const i of toDraft) {
        const { error: pErr } = await supa.from('posts').insert({
          org_id: f.org_id,
          campaign_id: f.campaign_id,
          status: 'draft',
          body: `${i.title}\n\n${i.link}`,
          link_url: i.link,
        });
        if (!pErr) drafted++;
      }
      if (fresh.length) {
        await supa
          .from('feed_items_seen')
          .upsert(fresh.map((i) => ({ feed_id: f.id, guid: i.guid })), { onConflict: 'feed_id,guid' });
      }
    } catch (e) {
      error = String((e as Error)?.message ?? e).slice(0, 300);
    }
    await supa
      .from('campaign_feeds')
      .update({ last_checked_at: new Date().toISOString(), last_error: error })
      .eq('id', f.id);
  }

  return { feeds: feeds?.length ?? 0, drafted };
}
