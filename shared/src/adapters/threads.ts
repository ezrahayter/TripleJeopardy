import { threadsGet, threadsPost, waitForContainer } from './meta-graph';
import { isVideoMime } from './media';
import type {
  CommentInput,
  CommentResult,
  MediaInput,
  MetricsInput,
  NetworkAdapter,
  PostMetrics,
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
  const videos = media.filter((m) => isVideoMime(m.mime));
  if (videos.length > 1 || (videos.length === 1 && media.length > 1)) {
    errors.push('Post a video on its own on Threads.');
  }
  for (const m of media) {
    if (!m.mime.startsWith('image/') && !isVideoMime(m.mime)) {
      errors.push(`Unsupported media type for Threads: ${m.mime}`);
    }
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

    const video = media.find((m) => isVideoMime(m.mime));
    if (video) {
      const c = await threadsPost<{ id: string }>(`${userId}/threads`, {
        media_type: 'VIDEO',
        video_url: video.url,
        text: body,
        access_token: secret,
      });
      creationId = c.id;
    } else if (media.length === 0) {
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

    if (media.length > 0) {
      await waitForContainer('threads', creationId, secret, video ? { tries: 30, delayMs: 4000 } : undefined);
    }

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

  async comment({ account, secret, parentId, body }: CommentInput): Promise<CommentResult> {
    const userId = account.externalId;
    if (!userId) throw new Error('threads comment needs the Threads user id');
    const container = await threadsPost<{ id: string }>(`${userId}/threads`, {
      media_type: 'TEXT',
      text: body,
      reply_to_id: parentId,
      access_token: secret,
    });
    const published = await threadsPost<{ id: string }>(`${userId}/threads_publish`, {
      creation_id: container.id,
      access_token: secret,
    });
    return { externalId: published.id };
  },

  async fetchMetrics({ secret, externalId }: MetricsInput): Promise<PostMetrics> {
    const out: PostMetrics = {};
    const ins = await threadsGet<{
      data?: Array<{ name?: string; values?: Array<{ value?: number }> }>;
    }>(`${externalId}/insights`, {
      metric: 'likes,replies,reposts,quotes,views',
      access_token: secret,
    });
    for (const x of ins.data ?? []) {
      const v = x.values?.[0]?.value ?? 0;
      if (x.name === 'likes') out.likes = v;
      if (x.name === 'replies') out.replies = v;
      if (x.name === 'reposts') out.reposts = v;
      if (x.name === 'quotes') out.quotes = v;
      if (x.name === 'views') out.views = v;
    }
    return out;
  },
};
