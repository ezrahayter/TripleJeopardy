import { createClient } from '@supabase/supabase-js';
import type { Env } from './index';

// Re-draft evergreen posts whose interval has elapsed. The original keeps its
// evergreen setting and gets recycled_at stamped; the copy is a plain draft.

interface Row {
  id: string;
  org_id: string;
  campaign_id: string;
  body: string;
  link_url: string | null;
  evergreen_days: number;
  recycled_at: string | null;
  updated_at: string;
}

export async function runEvergreen(env: Env): Promise<{ checked: number; recycled: number }> {
  const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: rows } = await supa
    .from('posts')
    .select('id, org_id, campaign_id, body, link_url, evergreen_days, recycled_at, updated_at')
    .eq('status', 'published')
    .gt('evergreen_days', 0)
    .limit(50);

  let recycled = 0;
  for (const p of (rows ?? []) as unknown as Row[]) {
    const anchor = new Date(p.recycled_at ?? p.updated_at).getTime();
    if (Date.now() - anchor < p.evergreen_days * 864e5) continue;

    const { data: copy } = await supa
      .from('posts')
      .insert({
        org_id: p.org_id,
        campaign_id: p.campaign_id,
        status: 'draft',
        body: p.body,
        link_url: p.link_url,
      })
      .select('id')
      .single();

    if (copy) {
      const { data: media } = await supa
        .from('post_media')
        .select('storage_path, sort, alt_text')
        .eq('post_id', p.id);
      for (const m of (media ?? []) as { storage_path: string; sort: number; alt_text: string }[]) {
        const ext = m.storage_path.split('.').pop() ?? 'bin';
        const dst = `${p.campaign_id}/${copy.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supa.storage.from('media').copy(m.storage_path, dst);
        if (!error) {
          await supa
            .from('post_media')
            .insert({ post_id: copy.id, storage_path: dst, sort: m.sort, alt_text: m.alt_text ?? '' });
        }
      }
      recycled++;
    }
    await supa.from('posts').update({ recycled_at: new Date().toISOString() }).eq('id', p.id);
  }

  return { checked: rows?.length ?? 0, recycled };
}
