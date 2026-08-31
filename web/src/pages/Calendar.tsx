import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { StatusChip } from '../components/StatusChip';
import type { PostStatus } from '@shared/types';

interface CalPost {
  id: string;
  body: string;
  status: PostStatus;
  scheduled_at: string | null;
  campaign: { name: string } | null;
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
  const [draftCount, setDraftCount] = useState(0);
  const [selected, setSelected] = useState<CalPost | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      .select('id, body, status, scheduled_at, campaign:campaigns(name)')
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

    const { count } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('scheduled_at', null)
      .eq('status', 'draft');
    setDraftCount(count ?? 0);
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
      {draftCount > 0 && (
        <p className="notice">
          {draftCount} unscheduled draft{draftCount > 1 ? 's' : ''} —{' '}
          <a
            href="/posts"
            onClick={(e) => {
              e.preventDefault();
              navigate('/posts');
            }}
          >
            open the list
          </a>{' '}
          to schedule them.
        </p>
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
                      setSelected(p);
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
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null);
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
  onChanged,
}: {
  post: CalPost;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [when, setWhen] = useState(toLocalInput(post.scheduled_at));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const published = post.status === 'published';

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

        {error && <p className="notice error">{error}</p>}

        {published ? (
          <div className="btnrow">
            <button className="btn secondary" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <label htmlFor="m-when">Scheduled for</label>
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
                Reschedule
              </button>
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
                Unschedule
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
