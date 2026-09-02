/**
 * Domain types shared by the web app and the publisher worker.
 * Phase 0 subset - widen `Network` and add tables as later phases land.
 */

export type Network = 'bluesky' | 'facebook' | 'instagram' | 'threads';

/** Networks connected via OAuth rather than a pasted credential. */
export const OAUTH_NETWORKS: Network[] = ['facebook', 'instagram', 'threads'];

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
  notify_email: string | null;
  created_at: string;
}

export type ApprovalMode = 'candidate' | 'designated' | 'waived';
export type ApprovalState = 'not_required' | 'pending' | 'changes_requested' | 'approved';

export interface Campaign {
  id: string;
  org_id: string;
  name: string;
  office: string | null;
  jurisdiction: string | null;
  election_date: string | null;
  timezone: string;
  approval_mode: ApprovalMode;
  approver_name: string | null;
  approver_email: string | null;
  waived_networks: string[];
  disclaimer: string | null;
  review_token: string;
  requests_enabled: boolean;
  publishing_paused: boolean;
  created_at: string;
}

export type CampaignDateKind = 'election' | 'filing' | 'debate' | 'fundraising' | 'milestone';

export interface CampaignDate {
  id: string;
  org_id: string;
  campaign_id: string;
  label: string;
  date: string;
  kind: CampaignDateKind;
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
  token_error: string | null;
  token_expires_at: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface Post {
  id: string;
  org_id: string;
  campaign_id: string;
  body: string;
  status: PostStatus;
  approval_state: ApprovalState;
  scheduled_at: string | null;
  first_comment: string | null;
  internal_note: string | null;
  body_overrides: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface ApprovalEvent {
  id: string;
  post_id: string;
  event: 'sent_for_review' | 'approved' | 'changes_requested' | 'reset';
  actor: string | null;
  note: string | null;
  created_at: string;
}

export interface PostMedia {
  id: string;
  post_id: string;
  storage_path: string;
  alt_text: string;
  sort: number;
}

export type RequestStatus = 'new' | 'accepted' | 'declined';

/** A candidate's ask for content, submitted from the `/review/<token>` portal. */
export interface PostRequest {
  id: string;
  org_id: string;
  campaign_id: string;
  submitter_email: string | null;
  request_kinds: string[];
  content_type: string | null;
  tied_to_event: boolean;
  event_date: string | null;
  event_time: string | null;
  event_location: string | null;
  rsvp_link: string | null;
  photos_video: 'have' | 'coming_soon' | 'none' | null;
  exact_wording: string | null;
  caption: string | null;
  reference: string | null;
  notes: string | null;
  platforms: string[];
  planned_publish: string | null;
  needs_submitter_approval: boolean;
  draft_lead: string | null;
  status: RequestStatus;
  decline_reason: string | null;
  assigned_to: string | null;
  created_post_id: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface PostRequestMedia {
  id: string;
  request_id: string;
  storage_path: string;
  filename: string | null;
  kind: 'resource' | 'media';
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
  metrics: Record<string, number>;
  metrics_synced_at: string | null;
  comment_external_id: string | null;
  comment_error: string | null;
}
