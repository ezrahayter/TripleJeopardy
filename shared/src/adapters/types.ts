/**
 * The one interface every network sits behind. A new network is a new file
 * that implements this - never a new branch through the publisher.
 */

export interface MediaInput {
  bytes: Uint8Array;
  mime: string;
  alt?: string;
}

export interface AccountRef {
  handle: string;
  serviceUrl: string;
  externalId?: string | null;
}

export interface PublishInput {
  account: AccountRef;
  /** Decrypted credential - Bluesky app password in Phase 0. */
  secret: string;
  body: string;
  media: MediaInput[];
}

export interface PublishResult {
  /** Canonical id on the network (an at:// uri for Bluesky). */
  externalId: string;
  /** Human-facing URL. */
  url: string;
}

export interface VerifyInput {
  handle: string;
  secret: string;
  serviceUrl: string;
}

export interface VerifyResult {
  /** Stable account id (a DID for Bluesky). */
  externalId: string;
  /** Normalized handle as the network reports it. */
  handle: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface NetworkAdapter {
  network: string;
  /** Cheap local checks before anything touches the network. */
  validate(input: { body: string; media: MediaInput[] }): ValidationResult;
  /** Confirm credentials work and resolve the account identity. */
  verify(input: VerifyInput): Promise<VerifyResult>;
  /** Publish one post to one account. Must be safe to call twice. */
  publish(input: PublishInput): Promise<PublishResult>;
}
