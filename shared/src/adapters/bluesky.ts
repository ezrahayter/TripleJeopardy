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

const MAX_GRAPHEMES = 300;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 1_000_000; // Bluesky rejects blobs over ~1 MB

interface Session {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
}

async function xrpc<T>(
  serviceUrl: string,
  method: string,
  opts: { token?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const target = new URL(`/xrpc/${method}`, serviceUrl);
  for (const [k, v] of Object.entries(opts.query ?? {})) target.searchParams.set(k, v);
  const res = await fetch(target, {
    method: opts.body === undefined ? 'GET' : 'POST',
    headers: {
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  if (!res.ok) {
    throw new Error(`bluesky ${method} failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as T;
}

async function createSession(
  serviceUrl: string,
  identifier: string,
  password: string,
): Promise<Session> {
  return xrpc<Session>(serviceUrl, 'com.atproto.server.createSession', {
    body: { identifier: identifier.replace(/^@/, ''), password },
  });
}

async function uploadBlob(
  serviceUrl: string,
  token: string,
  bytes: Uint8Array,
  mime: string,
): Promise<unknown> {
  const res = await fetch(new URL('/xrpc/com.atproto.repo.uploadBlob', serviceUrl), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': mime || 'application/octet-stream',
    },
    body: bytes as BodyInit,
  });
  if (!res.ok) {
    throw new Error(`bluesky uploadBlob failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { blob: unknown };
  return json.blob;
}

function countGraphemes(text: string): number {
  const intl = Intl as unknown as {
    Segmenter?: new (
      locales?: string,
      options?: { granularity: 'grapheme' },
    ) => { segment: (input: string) => Iterable<unknown> };
  };
  if (intl.Segmenter) {
    return [...new intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].length;
  }
  return [...text].length;
}

function validate({ body, media }: { body: string; media: MediaInput[] }): ValidationResult {
  const errors: string[] = [];
  if (!body.trim() && media.length === 0) errors.push('Nothing to post.');
  if (countGraphemes(body) > MAX_GRAPHEMES) {
    errors.push(`Text is over the ${MAX_GRAPHEMES}-character Bluesky limit.`);
  }
  if (media.length > MAX_IMAGES) errors.push(`Bluesky allows at most ${MAX_IMAGES} images.`);
  for (const m of media) {
    if (!m.mime.startsWith('image/')) errors.push(`Unsupported media type: ${m.mime}`);
    if (m.bytes && m.bytes.byteLength > MAX_IMAGE_BYTES) {
      errors.push('Each image must be under 1 MB.');
    }
  }
  return { ok: errors.length === 0, errors };
}

export const blueskyAdapter: NetworkAdapter = {
  network: 'bluesky',

  validate,

  async verify({ handle, secret, serviceUrl }: VerifyInput): Promise<VerifyResult> {
    if (!handle) throw new Error('bluesky verify needs a handle');
    const session = await createSession(serviceUrl ?? 'https://bsky.social', handle, secret);
    return { externalId: session.did, handle: session.handle };
  },

  async publish({ account, secret, body, media }: PublishInput): Promise<PublishResult> {
    const check = validate({ body, media });
    if (!check.ok) throw new Error(check.errors.join(' '));

    const session = await createSession(account.serviceUrl, account.handle, secret);

    let embed: Record<string, unknown> | undefined;
    if (media.length > 0) {
      const images: Array<{ alt: string; image: unknown }> = [];
      for (const m of media.slice(0, MAX_IMAGES)) {
        if (!m.bytes) throw new Error('Bluesky needs raw image bytes, not a URL.');
        images.push({
          alt: m.alt ?? '',
          image: await uploadBlob(account.serviceUrl, session.accessJwt, m.bytes, m.mime),
        });
      }
      embed = { $type: 'app.bsky.embed.images', images };
    }

    const record: Record<string, unknown> = {
      $type: 'app.bsky.feed.post',
      text: body,
      createdAt: new Date().toISOString(),
      ...(embed ? { embed } : {}),
    };

    const result = await xrpc<{ uri: string; cid: string }>(
      account.serviceUrl,
      'com.atproto.repo.createRecord',
      {
        token: session.accessJwt,
        body: { repo: session.did, collection: 'app.bsky.feed.post', record },
      },
    );

    const rkey = result.uri.split('/').pop() ?? '';
    return {
      externalId: result.uri,
      url: `https://bsky.app/profile/${session.handle}/post/${rkey}`,
    };
  },

  async comment({ account, secret, parentId, body }: CommentInput): Promise<CommentResult> {
    const session = await createSession(account.serviceUrl, account.handle, secret);
    // a reply needs the parent's cid as well as its uri
    const found = await xrpc<{ posts?: Array<{ uri: string; cid: string }> }>(
      account.serviceUrl,
      'app.bsky.feed.getPosts',
      { token: session.accessJwt, query: { uris: parentId } },
    );
    const parent = found.posts?.[0];
    if (!parent) throw new Error('parent post not found');
    const ref = { uri: parent.uri, cid: parent.cid };

    const result = await xrpc<{ uri: string }>(
      account.serviceUrl,
      'com.atproto.repo.createRecord',
      {
        token: session.accessJwt,
        body: {
          repo: session.did,
          collection: 'app.bsky.feed.post',
          record: {
            $type: 'app.bsky.feed.post',
            text: body,
            createdAt: new Date().toISOString(),
            reply: { root: ref, parent: ref },
          },
        },
      },
    );
    const rkey = result.uri.split('/').pop() ?? '';
    return {
      externalId: result.uri,
      url: `https://bsky.app/profile/${session.handle}/post/${rkey}`,
    };
  },

  async fetchMetrics({ externalId }: MetricsInput): Promise<PostMetrics> {
    // engagement counts are public — no session/credential needed
    const res = await xrpc<{
      posts?: Array<{
        likeCount?: number;
        repostCount?: number;
        replyCount?: number;
        quoteCount?: number;
      }>;
    }>('https://public.api.bsky.app', 'app.bsky.feed.getPosts', {
      query: { uris: externalId },
    });
    const p = res.posts?.[0];
    if (!p) return {};
    return {
      likes: p.likeCount ?? 0,
      reposts: p.repostCount ?? 0,
      replies: p.replyCount ?? 0,
      quotes: p.quoteCount ?? 0,
    };
  },
};
