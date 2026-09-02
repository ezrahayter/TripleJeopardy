/**
 * The one interface every network sits behind. A new network is a new file
 * that implements this - never a new branch through the publisher.
 */

export interface MediaInput {
  mime: string;
  alt?: string;
  /** Raw bytes - for networks that take a direct upload (Bluesky). */
  bytes?: Uint8Array;
  /** A public or signed URL - for networks that fetch the media themselves
   *  (Facebook, Instagram, Threads). The worker mints a short-lived signed
   *  Storage URL at publish time. */
  url?: string;
}

export interface AccountRef {
  handle: string;
  serviceUrl: string;
  /** did (Bluesky) · page id (Facebook) · IG business account id (Instagram) ·
   *  Threads user id (Threads). */
  externalId?: string | null;
  /** Adapter-specific extras stored on social_accounts.meta. */
  meta?: Record<string, unknown> | null;
}

export interface PublishInput {
  account: AccountRef;
  /** Decrypted publishing credential: Bluesky app password, or a Meta access
   *  token (Page token for FB/IG, user token for Threads). */
  secret: string;
  body: string;
  media: MediaInput[];
}

export interface PublishResult {
  /** Canonical id on the network (an at:// uri for Bluesky, `{page}_{post}`
   *  for Facebook, a media id for IG/Threads). */
  externalId: string;
  /** Human-facing URL. */
  url: string;
}

export interface VerifyInput {
  secret: string;
  handle?: string;
  externalId?: string;
  serviceUrl?: string;
}

export interface VerifyResult {
  externalId: string;
  handle: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/** Normalized engagement/reach. Every field optional — set only what the
 *  network actually reports. Stored on post_targets.metrics. */
export type PostMetrics = Partial<{
  likes: number;
  comments: number;
  shares: number;
  reposts: number;
  replies: number;
  quotes: number;
  saves: number;
  reach: number;
  impressions: number;
  views: number;
}>;

export interface MetricsInput {
  account: AccountRef;
  /** Decrypted publishing credential (same one used to publish). */
  secret: string;
  /** The published post's canonical id (post_targets.external_post_id). */
  externalId: string;
}

export interface CommentInput {
  account: AccountRef;
  secret: string;
  /** The just-published post to reply to (post_targets.external_post_id). */
  parentId: string;
  body: string;
}

export interface CommentResult {
  externalId: string;
  url?: string;
}

export interface NetworkAdapter {
  network: string;
  /** Cheap local checks before anything touches the network. */
  validate(input: { body: string; media: MediaInput[] }): ValidationResult;
  /** Confirm a credential still works and resolve the account identity.
   *  Used by the connect flow and the token-refresh sweep. */
  verify(input: VerifyInput): Promise<VerifyResult>;
  /** Publish one post to one account. Must be safe to call twice. */
  publish(input: PublishInput): Promise<PublishResult>;
  /** Pull engagement/reach for one published post. Optional — networks that
   *  don't implement it are skipped by the metrics sweep. */
  fetchMetrics?(input: MetricsInput): Promise<PostMetrics>;
  /** Post the first comment as a reply/comment on the just-published post.
   *  Optional. Failure here never fails the post. */
  comment?(input: CommentInput): Promise<CommentResult>;
}
