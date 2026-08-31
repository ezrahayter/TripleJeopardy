import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { StatusChip } from '../components/StatusChip';
import { PostThumbs } from '../components/PostThumbs';
import { ApprovalPanel } from '../components/ApprovalPanel';
import type { ApprovalState, Campaign, PostStatus } from '@shared/types';

const SELECT =
  'id, body, status, approval_state, scheduled_at, campaign:campaigns(id, name, approval_mode, approver_name)';

interface CalPost {
  id: string;
  body: string;
  status: PostStatus;
  approval_state: ApprovalState;
  scheduled_at: string | null;
  campaign: {
    id: string;
    name: string;
    approval_mode: Campaign['approval_mode'];
    approver_name: string | null;
  } | null;
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function Calendar({ orgId }: { orgId: string }) {
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [posts, setPosts] = useState<CalPost[]>([]);
  const [drafts, setDrafts] = useState<CalPost[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => [...posts, ...drafts].find((p) => p.id === selectedId) ?? null,
    [posts, drafts, selectedId],
  );

  const cells = useMemo(() => {
    const start = startOfMonth(month);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month]);

  const load = useCallback(async () => {
    const gridStart = new Date(cells[0]!);
    const gridEnd = new Date(cells[41]!);
    gridEnd.setDate(gridEnd.getDate() + 1);

    const { data, error } = await supabase
      .from('posts')
      .select(SELECT)
      .eq('org_id', orgId)
      .not('scheduled_at', 'is', null)
      .gte('scheduled_at', gridStart.toISOString())
      .lt('scheduled_at', gridEnd.toISOString())
      .order('scheduled_at');
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setPosts((data as unknown as CalPost[]) ?? []);

    const { data: draftRows } = await supabase
      .from('posts')
      .select(SELECT)
      .eq('org_id', orgId)
      .is('scheduled_at', null)
      .eq('status', 'draft')
      .order('created_at', { ascending: false });
    setDrafts((draftRows as unknown as CalPost[]) ?? []);
  }, [orgId, cells]);

  useEffect(() => {
    void load();
  }, [load]);

  const postsFor = (d: Date) =>
    posts.filter((p) => p.scheduled_at && sameDay(new Date(p.scheduled_at), d));

  function newPostOn(d: Date) {
    const at = new Date(d);
    at.setHours(9, 0, 0, 0);
    navigate(`/compose?at=${encodeURIComponent(at.toISOString())}`);
  }

  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <>
      <div className="cal-head">
        <h1>
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </h1>
        <div className="btnrow" style={{ marginTop: 0 }}>
          <button className="btn secondary" type="button" onClick={() => shift(-1)}>
            ‹
          </button>
          <button
            className="btn secondary"
            type="button"
            onClick={() => setMonth(startOfMonth(new Date()))}
          >
            Today
          </button>
          <button className="btn secondary" type="button" onClick={() => shift(1)}>
            ›
          </button>
        </div>
      </div>

      {error && <p className="notice error">{error}</p>}

      {drafts.length > 0 && (
        <div className="notice">
          <button
            type="button"
            className="draft-toggle"
            onClick={() => setShowDrafts((s) => !s)}
          >
            {showDrafts ? '▾' : '▸'} {drafts.length} unscheduled draft
            {drafts.length > 1 ? 's' : ''}
          </button>
          {showDrafts && (
            <div className="draft-list">
              {drafts.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="draft-row"
                  onClick={() => setSelectedId(d.id)}
                >
                  <strong>{d.campaign?.name ?? '—'}</strong>{' '}
                  {d.body ? d.body.slice(0, 80) : '(no text)'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="cal-scroll">
        <div className="cal-grid">
          {DOW.map((d) => (
            <div className="cal-dow" key={d}>
              {d}
            </div>
          ))}
          {cells.map((d, i) => {
            const inMonth = d.getMonth() === month.getMonth();
            const today = sameDay(d, new Date());
            return (
              <div
                className={`cal-cell${inMonth ? '' : ' out'}${today ? ' today' : ''}`}
                key={i}
                onClick={() => newPostOn(d)}
              >
                <span className="cal-date">{d.getDate()}</span>
                {postsFor(d).map((p) => (
                  <button
                    key={p.id}
                    className="cal-post"
                    data-status={p.status}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(p.id);
                    }}
                  >
                    <span className="txt">
                      {p.campaign?.name ?? '—'}: {p.body || '(no text)'}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <PostModal
          post={selected}
          onClose={() => setSelectedId(null)}
          onReload={load}
          onChanged={() => {
            setSelectedId(null);
            void load();
          }}
        />
      )}
    </>
  );
}

function PostModal({
  post,
  onClose,
  onReload,
  onChanged,
}: {
  post: CalPost;
  onClose: () => void;
  onReload: () => Promise<void>;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [when, setWhen] = useState(toLocalInput(post.scheduled_at));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const published = post.status === 'published';
  const isDraft = post.status === 'draft';

  async function run(op: PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    setError(null);
    const { error } = await op;
    setBusy(false);
    if (error) setError(error.message);
    else onChanged();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <StatusChip status={post.status} />
          <strong>{post.campaign?.name}</strong>
        </div>
        <p className="body">{post.body || <span className="muted">(no text)</span>}</p>
        <PostThumbs postId={post.id} />

        {post.campaign && (
          <ApprovalPanel
            post={{
              id: post.id,
              campaign_id: post.campaign.id,
              approval_state: post.approval_state,
            }}
            campaign={{
              approval_mode: post.campaign.approval_mode,
              approver_name: post.campaign.approver_name,
            }}
            onChange={() => void onReload()}
          />
        )}

        {error && <p className="notice error">{error}</p>}

        {published ? (
          <div className="btnrow">
            <button className="btn secondary" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <label htmlFor="m-when">{isDraft ? 'Put on the calendar for' : 'Scheduled for'}</label>
            <input
              id="m-when"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
            <div className="btnrow">
              <button
                className="btn"
                type="button"
                disabled={busy || !when}
                onClick={() =>
                  void run(
                    supabase
                      .from('posts')
                      .update({ status: 'scheduled', scheduled_at: new Date(when).toISOString() })
                      .eq('id', post.id),
                  )
                }
              >
                {isDraft ? 'Add to calendar' : 'Reschedule'}
              </button>
              {!isDraft && (
                <button
                  className="btn secondary"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      supabase
                        .from('posts')
                        .update({ status: 'draft', scheduled_at: null })
                        .eq('id', post.id),
                    )
                  }
                >
                  Move to drafts
                </button>
              )}
              <button
                className="btn secondary"
                type="button"
                onClick={() => navigate(`/compose/${post.id}`)}
              >
                Edit
              </button>
              <button
                className="btn danger"
                type="button"
                disabled={busy}
                onClick={() => void run(supabase.from('posts').delete().eq('id', post.id))}
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
