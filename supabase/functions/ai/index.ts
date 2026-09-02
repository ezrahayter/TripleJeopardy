// POST /functions/v1/ai   { task, input, context? }   (operator JWT)
//
// Small writing helpers for the composer and the approval loop. No-ops with a
// clear message when ANTHROPIC_API_KEY isn't set.
//   task: caption | rewrite | tone | hashtags | feedback | rapid
//   -> { text }  or  { options: string[] }

import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, jsonResponse as json } from '../_shared/cors.ts';

const SYSTEM =
  `You write social copy for political candidates' organic feeds (Facebook, Instagram, ` +
  `Bluesky, Threads). Voice: plain, direct, human — never corporate, never hashtag soup, ` +
  `never em-dashes. Keep it tight. Return only the copy, no preamble or quotes.`;

const PROMPTS: Record<string, (input: string, ctx: Record<string, unknown>) => string> = {
  caption: (input) =>
    `Write one social post from these notes. One or two short sentences.\n\nNotes:\n${input}`,
  rewrite: (input) => `Rewrite this post so it lands better. Keep the meaning.\n\n${input}`,
  tone: (input, ctx) =>
    `Rewrite this post to be ${String(ctx.tone ?? 'punchier')}. Keep the meaning.\n\n${input}`,
  hashtags: (input) =>
    `Suggest 3-5 relevant hashtags for this post. Return them space-separated on one line, nothing else.\n\n${input}`,
  feedback: (input, ctx) =>
    `A candidate reviewed this draft and left a vague note. Turn the note into a short, ` +
    `concrete list of edits the writer can act on.\n\nDraft:\n${input}\n\nCandidate's note:\n${String(
      ctx.note ?? '',
    )}`,
  rapid: (input) =>
    `Draft 3 distinct short rapid-response posts about this. Separate them with a line of "---".\n\n${input}`,
};

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
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u.user) return json({ error: 'Invalid session' }, 401);

    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'AI is not configured yet.' }, 503);

    const { task, input, context } = await req.json();
    const build = PROMPTS[task];
    if (!build || typeof input !== 'string' || !input.trim()) {
      return json({ error: 'task and input are required' }, 400);
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-5',
        max_tokens: 1024,
        output_config: { effort: 'low' },
        system: SYSTEM,
        messages: [{ role: 'user', content: build(input.slice(0, 4000), context ?? {}) }],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('anthropic', res.status, JSON.stringify(data));
      return json({ error: data?.error?.message ?? 'AI request failed' }, 502);
    }
    const text: string =
      (data.content ?? []).find((b: { type?: string }) => b.type === 'text')?.text?.trim() ?? '';

    if (task === 'rapid') {
      return json({ options: text.split(/\n-{3,}\n/).map((s: string) => s.trim()).filter(Boolean) });
    }
    return json({ text });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 400);
  }
});
