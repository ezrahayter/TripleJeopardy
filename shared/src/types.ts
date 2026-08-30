/**
 * Domain types shared by the web app and the publisher worker.
 * Phase 0 subset - widen `Network` and add tables as later phases land.
 */

export type Network = 'bluesky';

export type PostStatus =
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed';

export type TargetStatus = 'pending' | 'publishing' | 'published' | 'failed';

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'dead';

export type AccountType = 'official' | 'personal' | 'surrogate';

export interface Org {
  id: string;
  name: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  org_id: string;
  name: string;
  office: string | null;
  jurisdiction: string | null;
  election_date: string | null;
  timezone: string;
  created_at: string;
}

export interface SocialAccount {
  id: string;
  org_id: string;
  campaign_id: string;
  network: Network;
  account_type: AccountType;
  handle: string;
  external_id: string | null;
  service_url: string;
  status: 'active' | 'error' | 'revoked';
  created_at: string;
}

export interface Post {
  id: string;
  org_id: string;
  campaign_id: string;
  body: string;
  status: PostStatus;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostMedia {
  id: string;
  post_id: string;
  storage_path: string;
  alt_text: string;
  sort: number;
}

export interface PostTarget {
  id: string;
  post_id: string;
  social_account_id: string;
  status: TargetStatus;
  external_post_id: string | null;
  external_url: string | null;
  error: string | null;
  published_at: string | null;
}
