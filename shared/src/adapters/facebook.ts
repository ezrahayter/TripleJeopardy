import { graphGet, graphPost } from './meta-graph';
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

// Facebook Pages caption limit is generous (~63k); keep a sane guard.
const MAX_TEXT = 60_000;

function validate({ body, media }: { body: string; media: MediaInput[] }): ValidationResult {
  const errors: string[] = [];
  if (!body.trim() && media.length === 0) errors.push('Nothing to post.');
  if (body.length > MAX_TEXT) errors.push('Text is too long for a Facebook post.');
  const videos = media.filter((m) => isVideoMime(m.mime));
  if (videos.length > 0 && media.length > 1) {
    errors.push('Attach a video on its own, not alongside photos.');
  }
  for (const m of media) {
    if (!m.mime.startsWith('image/') && !isVideoMime(m.mime)) {
      errors.push(`Unsupported media type for Facebook: ${m.mime}`);
    }
    if (!m.url) errors.push('Facebook needs a fetchable media URL.');
  }
  return { ok: errors.length === 0, errors };
}

export const facebookAdapter: NetworkAdapter = {
  network: 'facebook',

  validate,

  async verify({ secret, externalId }: VerifyInput): Promise<VerifyResult> {
    if (!externalId) throw new Error('facebook verify needs the Page id');
    const page = await graphGet<{ id: string; name: string }>(externalId, {
      fields: 'id,name',
      access_token: secret,
    });
    return { externalId: page.id, handle: page.name };
  },

  async publish({ account, secret, body, media }: PublishInput): Promise<PublishResult> {
    const check = validate({ body, media });
    if (!check.ok) throw new Error(check.errors.join(' '));

    const pageId = account.externalId;
    if (!pageId) throw new Error('facebook publish needs the Page id');

    let postId: string;

    const video = media.find((m) => isVideoMime(m.mime));
    if (video) {
      // Page video upload — Graph pulls the file itself from file_url
      const res = await graphPost<{ id: string; post_id?: string }>(`${pageId}/videos`, {
        file_url: video.url,
        description: body,
        access_token: secret,
      });
      postId = res.post_id ?? res.id;
    } else if (media.length === 0) {
      const res = await graphPost<{ id: string }>(`${pageId}/feed`, {
        message: body,
        access_token: secret,
      });
      postId = res.id;
    } else if (media.length === 1) {
      const res = await graphPost<{ id: string; post_id?: string }>(`${pageId}/photos`, {
        url: media[0]!.url,
        caption: body,
        access_token: secret,
      });
      postId = res.post_id ?? res.id;
    } else {
      // upload each photo unpublished, then attach to one feed story
      const fbids: string[] = [];
      for (const m of media) {
        const up = await graphPost<{ id: string }>(`${pageId}/photos`, {
          url: m.url,
          published: 'false',
          access_token: secret,
        });
        fbids.push(up.id);
      }
      const params: Record<string, string> = { message: body, access_token: secret };
      fbids.forEach((id, i) => {
        params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
      });
      const res = await graphPost<{ id: string }>(`${pageId}/feed`, params);
      postId = res.id;
    }

    const permalink = await graphGet<{ permalink_url?: string }>(postId, {
      fields: 'permalink_url',
      access_token: secret,
    }).catch(() => ({ permalink_url: undefined }));

    return {
      externalId: postId,
      url: permalink.permalink_url ?? `https://www.facebook.com/${postId}`,
    };
  },

  async comment({ secret, parentId, body }: CommentInput): Promise<CommentResult> {
    const res = await graphPost<{ id: string }>(`${parentId}/comments`, {
      message: body,
      access_token: secret,
    });
    return { externalId: res.id };
  },

  async fetchMetrics({ secret, externalId }: MetricsInput): Promise<PostMetrics> {
    const out: PostMetrics = {};
    const p = await graphGet<{
      likes?: { summary?: { total_count?: number } };
      comments?: { summary?: { total_count?: number } };
      shares?: { count?: number };
    }>(externalId, {
      fields: 'likes.summary(true),comments.summary(true),shares',
      access_token: secret,
    });
    out.likes = p.likes?.summary?.total_count ?? 0;
    out.comments = p.comments?.summary?.total_count ?? 0;
    out.shares = p.shares?.count ?? 0;

    // reach/impressions need read_insights — skip quietly if the token lacks it
    try {
      const ins = await graphGet<{
        data?: Array<{ name?: string; values?: Array<{ value?: number }> }>;
      }>(`${externalId}/insights`, {
        metric: 'post_impressions,post_impressions_unique',
        access_token: secret,
      });
      for (const m of ins.data ?? []) {
        const v = m.values?.[0]?.value ?? 0;
        if (m.name === 'post_impressions') out.impressions = v;
        if (m.name === 'post_impressions_unique') out.reach = v;
      }
    } catch {
      /* insights unavailable — engagement counts still returned */
    }
    return out;
  },
};
