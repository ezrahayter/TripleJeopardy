import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ApprovalEvent, ApprovalMode, ApprovalState } from '@shared/types';

const STATE_LABEL: Record<ApprovalState, string> = {
  not_required: 'not sent',
  pending: 'in review',
  changes_requested: 'changes requested',
  approved: 'approved',
};

const EVENT_LABEL: Record<ApprovalEvent['event'], string> = {
  sent_for_review: 'Sent for review',
  approved: 'Approved',
  changes_requested: 'Changes requested',
  reset: 'Approval reset — post edited',
};

export function ApprovalPanel({
  post,
  campaign,
  onChange,
}: {
  post: { id: string; campaign_id: string; approval_state: ApprovalState };
  campaign: { approval_mode: ApprovalMode; approver_name: string | null };
  onChange: () => void;
}) {
  const [events, setEvents] = useState<ApprovalEvent[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const { data: ev } = await supabase
      .from('approval_events')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: false });
    setEvents((ev as unknown as ApprovalEvent[]) ?? []);
    const { data: link } = await supabase
      .from('review_links')
      .select('token')
      .eq('post_id', post.id)
      .is('decided_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setToken((link?.token as string) ?? null);
  }, [post.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (campaign.approval_mode === 'waived') {
    return (
      <p className="muted" style={{ fontSize: '0.85rem', marginTop: 10 }}>
        Approval is waived for this campaign — posts publish without sign-off.
      </p>
    );
  }

  const reviewUrl = token ? `${window.location.origin}/review/${token}` : null;
  const lastNote = events.find((e) => e.event === 'changes_requested')?.note;

  async function sendForReview() {
    setBusy(true);
    setErr(null);
    const { data: link, error } = await supabase
      .from('review_links')
      .insert({ post_id: post.id, campaign_id: post.campaign_id })
      .select('token')
      .single();
    if (error || !link) {
      setErr(error?.message ?? 'Could not create a review link.');
      setBusy(false);
      return;
    }
    await supabase.from('posts').update({ approval_state: 'pending' }).eq('id', post.id);
    await supabase
      .from('approval_events')
      .insert({ post_id: post.id, event: 'sent_for_review', actor: 'operator' });
    setBusy(false);
    await load();
    onChange();
  }

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--rule)', paddingTop: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="appr-chip" data-appr={post.approval_state}>
          {STATE_LABEL[post.approval_state]}
        </span>
        {campaign.approver_name && <span className="muted">· {campaign.approver_name}</span>}
      </div>

      {err && <p className="notice error">{err}</p>}

      {lastNote && post.approval_state === 'changes_requested' && (
        <p className="notice">Changes requested: “{lastNote}”</p>
      )}

      {(post.approval_state === 'not_required' || post.approval_state === 'changes_requested') && (
        <div className="btnrow" style={{ marginTop: 10 }}>
          <button className="btn" type="button" disabled={busy} onClick={() => void sendForReview()}>
            {post.approval_state === 'changes_requested' ? 'Send back for review' : 'Send for review'}
          </button>
        </div>
      )}

      {post.approval_state === 'pending' && reviewUrl && (
        <div style={{ marginTop: 10 }}>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            Send this link to {campaign.approver_name ?? 'your reviewer'} (no login needed):
          </p>
          <div className="btnrow" style={{ marginTop: 6 }}>
            <input
              readOnly
              value={reviewUrl}
              onFocus={(e) => e.target.select()}
              style={{ flex: 1 }}
            />
            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(reviewUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {events.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary className="muted" style={{ fontSize: '0.8rem', cursor: 'pointer' }}>
            History ({events.length})
          </summary>
          <ul style={{ fontSize: '0.8rem', margin: '6px 0 0', paddingLeft: 16, color: 'var(--olive)' }}>
            {events.map((e) => (
              <li key={e.id} style={{ marginBottom: 3 }}>
                {EVENT_LABEL[e.event]} — {e.actor ?? '?'} ·{' '}
                {new Date(e.created_at).toLocaleString()}
                {e.note && <> — “{e.note}”</>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
