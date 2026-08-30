import { threadsGet, threadsPost, waitForContainer } from './meta-graph';
import type {
  MediaInput,
  NetworkAdapter,
  PublishInput,
  PublishResult,
  ValidationResult,
  VerifyInput,
  VerifyResult,
} from './types';

const MAX_TEXT = 500;
const MAX_ITEMS = 20;

function validate({ body, media }: { body: string; media: MediaInput[] }): ValidationResult {
  const errors: string[] = [];
  if (!body.trim() && media.length === 0) errors.push('Nothing to post.');
  if ([...body].length > MAX_TEXT) errors.push(`Text is over the ${MAX_TEXT}-character Threads limit.`);
  if (media.length > MAX_ITEMS) errors.push(`Threads carousels hold at most ${MAX_ITEMS} items.`);
  for (const m of media) {
    if (!m.mime.startsWith('image/')) errors.push(`Threads (Phase 1) supports images only: ${m.mime}`);
    if (!m.url) errors.push('Threads needs a fetchable media URL.');
  }
  return { ok: errors.length === 0, errors };
}

export const threadsAdapter: NetworkAdapter = {
  network: 'threads',

  validate,

  async verify({ secret, externalId }: VerifyInput): Promise<VerifyResult> {
    const target = externalId ?? 'me';
    const me = await threadsGet<{ id: string; username: string }>(target, {
      fields: 'id,username',
      access_token: secret,
    });
    return { externalId: me.id, handle: me.username };
  },

  async publish({ account, secret, body, media }: PublishInput): Promise<PublishResult> {
    const check = validate({ body, media });
    if (!check.ok) throw new Error(check.errors.join(' '));

    const userId = account.externalId;
    if (!userId) throw new Error('threads publish needs the Threads user id');

    let creationId: string;

    if (media.length === 0) {
      const c = await threadsPost<{ id: string }>(`${userId}/threads`, {
        media_type: 'TEXT',
        text: body,
        access_token: secret,
      });
      creationId = c.id;
    } else if (media.length === 1) {
      const c = await threadsPost<{ id: string }>(`${userId}/threads`, {
        media_type: 'IMAGE',
        image_url: media[0]!.url,
        text: body,
        access_token: secret,
      });
      creationId = c.id;
    } else {
      const childIds: string[] = [];
      for (const m of media) {
        const child = await threadsPost<{ id: string }>(`${userId}/threads`, {
          media_type: 'IMAGE',
          image_url: m.url,
          is_carousel_item: 'true',
          access_token: secret,
        });
        childIds.push(child.id);
      }
      const parent = await threadsPost<{ id: string }>(`${userId}/threads`, {
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        text: body,
        access_token: secret,
      });
      creationId = parent.id;
    }

    if (media.length > 0) await waitForContainer('threads', creationId, secret);

    const published = await threadsPost<{ id: string }>(`${userId}/threads_publish`, {
      creation_id: creationId,
      access_token: secret,
    });

    const info = await threadsGet<{ permalink?: string }>(published.id, {
      fields: 'permalink',
      access_token: secret,
    }).catch(() => ({ permalink: undefined }));

    return {
      externalId: published.id,
      url: info.permalink ?? `https://www.threads.net/@${account.handle}`,
    };
  },
};
