import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret } from '../../shared/src/crypto';
import { getAdapter } from '../../shared/src/adapters';
import type { MediaInput } from '../../shared/src/adapters';
import { guessMime, isVideoMime } from '../../shared/src/adapters/media';
import type { Env } from './index';

const BATCH = 10;
const SIGNED_URL_TTL = 3600;

// Workers forbids random/IO at module scope - generate the id lazily.
let workerId: string | undefined;
const getWorkerId = () => (workerId ??= crypto.randomUUID());

interface ClaimedJob {
  id: string;
  post_target_id: string;
  attempts: number;
}

export async function runPublisher(env: Env): Promise<{
  worker: string;
  claimed: number;
  results: Array<{ job: string; ok: boolean; detail: string }>;
}> {
  const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: jobs, error } = await supa.rpc('tj_claim_publish_jobs', {
    p_worker: getWorkerId(),
    p_limit: BATCH,
  });
  if (error) throw new Error(`claim failed: ${error.message}`);

  const results: Array<{ job: string; ok: boolean; detail: string }> = [];

  for (const job of (jobs ?? []) as ClaimedJob[]) {
    try {
      const url = await publishOne(supa, env, job);
      results.push({ job: job.id, ok: true, detail: url });
    } catch (e) {
      const message = String((e as Error)?.message ?? e);
      await supa.rpc('tj_fail_job', { p_job: job.id, p_error: message });
      results.push({ job: job.id, ok: false, detail: message });
    }
  }

  return { worker: getWorkerId(), claimed: jobs?.length ?? 0, results };
}

async function publishOne(supa: SupabaseClient, env: Env, job: ClaimedJob): Promise<string> {
  const { data: target, error: tErr } = await supa
    .from('post_targets')
    .select(
      `id,
       post:posts ( id, body, body_overrides, first_comment, thread_parts ),
       account:social_accounts ( network, handle, service_url, external_id, meta, secret_ciphertext )`,
    )
    .eq('id', job.post_target_id)
    .single();
  if (tErr || !target) throw new Error(`target not found: ${tErr?.message ?? 'missing'}`);

  const post = (target as Record<string, any>).post;
  const account = (target as Record<string, any>).account;
  if (!account?.secret_ciphertext) throw new Error('connected account has no stored credential');

  await supa.from('post_targets').update({ status: 'publishing' }).eq('id', job.post_target_id);

  const { data: mediaRows } = await supa
    .from('post_media')
    .select('storage_path, alt_text, sort')
    .eq('post_id', post.id)
    .order('sort');

  const media: MediaInput[] = [];
  for (const row of mediaRows ?? []) {
    const mime = guessMime(row.storage_path);
    // Bluesky takes raw image bytes; everything else (and all video) is handed
    // off as a signed URL the network fetches itself.
    const wantsBytes = account.network === 'bluesky' && !isVideoMime(mime);
    if (wantsBytes) {
      const { data: file, error: dlErr } = await supa.storage
        .from('media')
        .download(row.storage_path);
      if (dlErr || !file) throw new Error(`media download failed: ${dlErr?.message ?? 'missing'}`);
      media.push({
        bytes: new Uint8Array(await file.arrayBuffer()),
        mime: file.type || mime,
        alt: row.alt_text ?? '',
      });
    } else {
      const { data: signed, error: sErr } = await supa.storage
        .from('media')
        .createSignedUrl(row.storage_path, SIGNED_URL_TTL);
      if (sErr || !signed?.signedUrl) {
        throw new Error(`could not sign media url: ${sErr?.message ?? 'missing'}`);
      }
      media.push({ url: signed.signedUrl, mime, alt: row.alt_text ?? '' });
    }
  }

  const secret = await decryptSecret(account.secret_ciphertext, env.TJ_ENCRYPTION_KEY);
  const adapter = getAdapter(account.network);

  // a per-network text override wins over the shared body
  const overrides = (post.body_overrides ?? {}) as Record<string, string>;
  const body = overrides[account.network]?.trim() || post.body || '';

  const accountRef = {
    handle: account.handle,
    serviceUrl: account.service_url,
    externalId: account.external_id,
    meta: account.meta ?? null,
  };

  const result = await adapter.publish({ account: accountRef, secret, body, media });

  await supa.rpc('tj_complete_job', {
    p_job: job.id,
    p_external_id: result.externalId,
    p_external_url: result.url,
  });

  // thread parts — publish as a native reply-chain. Best effort: a mid-chain
  // failure is recorded but never un-publishes what already went out.
  const threadParts: Array<{ body?: string }> = Array.isArray(post.thread_parts)
    ? post.thread_parts
    : [];
  if (threadParts.length > 0 && adapter.appendToThread) {
    let parentId = result.externalId;
    let posted = 0;
    let threadError: string | null = null;
    for (const part of threadParts) {
      const text = (part.body ?? '').trim();
      if (!text) continue;
      try {
        const r = await adapter.appendToThread({
          account: accountRef,
          secret,
          rootId: result.externalId,
          parentId,
          body: text,
        });
        parentId = r.externalId;
        posted += 1;
      } catch (e) {
        threadError = String((e as Error)?.message ?? e).slice(0, 500);
        break;
      }
    }
    await supa
      .from('post_targets')
      .update({ thread_posted: posted, thread_error: threadError })
      .eq('id', job.post_target_id);
  }

  // first comment — best effort, never fails the (already published) post
  const firstComment = (post.first_comment ?? '').trim();
  if (firstComment && adapter.comment) {
    try {
      const c = await adapter.comment({
        account: accountRef,
        secret,
        parentId: result.externalId,
        body: firstComment,
      });
      await supa
        .from('post_targets')
        .update({ comment_external_id: c.externalId, comment_error: null })
        .eq('id', job.post_target_id);
    } catch (e) {
      await supa
        .from('post_targets')
        .update({ comment_error: String((e as Error)?.message ?? e).slice(0, 500) })
        .eq('id', job.post_target_id);
    }
  }

  return result.url;
}
