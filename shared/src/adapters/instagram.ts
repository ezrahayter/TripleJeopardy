import { graphGet, graphPost, waitForContainer } from './meta-graph';
import type {
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

const MAX_CAPTION = 2200;
const MAX_ITEMS = 10; // carousel max

function validate({ body, media }: { body: string; media: MediaInput[] }): ValidationResult {
  const errors: string[] = [];
  if (media.length === 0) errors.push('Instagram requires at least one image.');
  if (media.length > MAX_ITEMS) errors.push(`Instagram carousels hold at most ${MAX_ITEMS} images.`);
  if (body.length > MAX_CAPTION) errors.push(`Caption is over the ${MAX_CAPTION}-character limit.`);
  for (const m of media) {
    if (!m.mime.startsWith('image/')) errors.push(`Instagram (Phase 1) supports images only: ${m.mime}`);
    if (!m.url) errors.push('Instagram needs a fetchable media URL.');
  }
  return { ok: errors.length === 0, errors };
}

export const instagramAdapter: NetworkAdapter = {
  network: 'instagram',

  validate,

  async verify({ secret, externalId }: VerifyInput): Promise<VerifyResult> {
    if (!externalId) throw new Error('instagram verify needs the IG business account id');
    const acct = await graphGet<{ id: string; username: string }>(externalId, {
      fields: 'id,username',
      access_token: secret,
    });
    return { externalId: acct.id, handle: acct.username };
  },

  async publish({ account, secret, body, media }: PublishInput): Promise<PublishResult> {
    const check = validate({ body, media });
    if (!check.ok) throw new Error(check.errors.join(' '));

    const igUserId = account.externalId;
    if (!igUserId) throw new Error('instagram publish needs the IG business account id');

    let creationId: string;

    if (media.length === 1) {
      const container = await graphPost<{ id: string }>(`${igUserId}/media`, {
        image_url: media[0]!.url,
        caption: body,
        access_token: secret,
      });
      creationId = container.id;
    } else {
      const childIds: string[] = [];
      for (const m of media) {
        const child = await graphPost<{ id: string }>(`${igUserId}/media`, {
          image_url: m.url,
          is_carousel_item: 'true',
          access_token: secret,
        });
        childIds.push(child.id);
      }
      const parent = await graphPost<{ id: string }>(`${igUserId}/media`, {
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        caption: body,
        access_token: secret,
      });
      creationId = parent.id;
    }

    await waitForContainer('graph', creationId, secret);

    const published = await graphPost<{ id: string }>(`${igUserId}/media_publish`, {
      creation_id: creationId,
      access_token: secret,
    });

    const info = await graphGet<{ permalink?: string }>(published.id, {
      fields: 'permalink',
      access_token: secret,
    }).catch(() => ({ permalink: undefined }));

    return {
      externalId: published.id,
      url: info.permalink ?? `https://www.instagram.com/p/${published.id}`,
    };
  },

  async fetchMetrics({ secret, externalId }: MetricsInput): Promise<PostMetrics> {
    const out: PostMetrics = {};
    const m = await graphGet<{ like_count?: number; comments_count?: number }>(externalId, {
      fields: 'like_count,comments_count',
      access_token: secret,
    });
    out.likes = m.like_count ?? 0;
    out.comments = m.comments_count ?? 0;

    try {
      const ins = await graphGet<{
        data?: Array<{ name?: string; values?: Array<{ value?: number }> }>;
      }>(`${externalId}/insights`, {
        metric: 'reach,saved,shares',
        access_token: secret,
      });
      for (const x of ins.data ?? []) {
        const v = x.values?.[0]?.value ?? 0;
        if (x.name === 'reach') out.reach = v;
        if (x.name === 'saved') out.saves = v;
        if (x.name === 'shares') out.shares = v;
      }
    } catch {
      /* insights unavailable — like/comment counts still returned */
    }
    return out;
  },
};
