import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { StatusChip } from '../components/StatusChip';
import { PostThumbs } from '../components/PostThumbs';
import { ApprovalPanel } from '../components/ApprovalPanel';
import type { Campaign, Post, PostTarget } from '@shared/types';

type Row = Post & {
  campaign:
    | {
        id: string;
        name: string;
        approval_mode: Campaign['approval_mode'];
        approver_name: string | null;
      }
    | null;
  post_targets: Array<Pick<PostTarget, 'status' | 'external_url' | 'error'>>;
};

export function Posts({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('posts')
      .select(
        '*, campaign:campaigns(id, name, approval_mode, approver_name), post_targets(status, external_url, error)',
      )
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) setError(error.message);
    else setRows((data as unknown as Row[]) ?? []);
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <h1>Posts</h1>
      <p className="sub">
        Scheduled posts are picked up by the publisher within a minute of their target time.
      </p>
      <div className="btnrow" style={{ marginTop: 0 }}>
        <Link className="btn" to="/compose">
          New post
        </Link>
        <button className="btn secondary" type="button" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {error && <p className="notice error">{error}</p>}
      {loading && <p className="muted">Loading…</p>}
      {!loading && rows.length === 0 && <p className="muted">No posts yet.</p>}

      {rows.map((row) => (
        <div className="card" key={row.id}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusChip status={row.status} />
            <strong>{row.campaign?.name ?? 'Unknown campaign'}</strong>
            {row.scheduled_at && (
              <span className="muted">
                {row.status === 'published' ? 'published' : 'for'}{' '}
                {new Date(row.scheduled_at).toLocaleString()}
              </span>
            )}
          </div>
          <p className="body">{row.body || <span className="muted">(no text)</span>}</p>
          <PostThumbs postId={row.id} />

          {row.post_targets.map((t, i) => (
            <div className="meta" key={i}>
              → {t.status}
              {t.external_url && (
                <>
                  {' · '}
                  <a href={t.external_url} target="_blank" rel="noreferrer">
                    view
                  </a>
                </>
              )}
              {t.error && <> · {t.error}</>}
            </div>
          ))}

          {row.campaign && row.status !== 'published' && (
            <ApprovalPanel
              post={{ id: row.id, campaign_id: row.campaign.id, approval_state: row.approval_state }}
              campaign={{
                approval_mode: row.campaign.approval_mode,
                approver_name: row.campaign.approver_name,
              }}
              onChange={() => void load()}
            />
          )}

          {row.status !== 'published' && (
            <div className="btnrow">
              <Link className="btn secondary" to={`/compose/${row.id}`}>
                Edit
              </Link>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
