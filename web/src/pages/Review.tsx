import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, MessageSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RequestWizard } from '@/components/review/RequestWizard';

interface Comment {
  author: 'operator' | 'reviewer';
  author_name: string | null;
  body: string;
  resolved: boolean;
  created_at: string;
}
interface PendingPost {
  id: string;
  body: string;
  scheduled_at: string | null;
  media: string[];
  threadParts: string[];
  lastNote: string | null;
  comments: Comment[];
}
interface ScheduledPost {
  id: string;
  body: string;
  scheduled_at: string;
  status: string;
}
interface RecentItem {
  event: string;
  note: string | null;
  created_at: string;
  body: string;
}
interface Data {
  campaign: string;
  reviewer: string | null;
  requestsEnabled: boolean;
  networks: string[];
  pending: PendingPost[];
  scheduled: ScheduledPost[];
  recent: RecentItem[];
  error?: string;
}

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/review`;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

function whenLabel(iso: string | null) {
  if (!iso) return 'Not scheduled';
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function Review() {
  const { token } = useParams();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showRecent, setShowRecent] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const loadFn = useCallback(async () => {
    try {
      const res = await fetch(`${FN}?token=${token}`, { headers });
      const body = (await res.json()) as Data;
      if (!res.ok) setErr(body.error ?? 'Could not load this review.');
      else setData(body);
    } catch {
      setErr('Could not reach the server.');
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void loadFn();
  }, [loadFn]);

  async function decide(postId: string, decision: 'approved' | 'changes_requested', note: string) {
    const res = await fetch(FN, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ token, post_id: postId, decision, note }),
    });
    const body = await res.json();
    if (!res.ok && !body.pending) throw new Error(body.error ?? 'Something went wrong.');
    setData((d) => (d ? { ...d, pending: body.pending ?? d.pending } : d));
  }

  async function comment(postId: string, body: string) {
    const res = await fetch(FN, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ token, action: 'comment', post_id: postId, body }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? 'Something went wrong.');
    await loadFn();
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-12">
      <div className="mb-8">
        <div className="font-display text-lg font-black tracking-tight">Triple Jeopardy</div>
        <div className="dateline mt-1">Positive Force</div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {err && !data && <p className="text-sm text-destructive">{err}</p>}

      {data && (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black tracking-tight">Posts to review</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.campaign}
                {data.reviewer ? ` · ${data.reviewer}` : ''} · {data.pending.length} waiting
              </p>
            </div>
            {data.requestsEnabled && !requesting && (
              <Button variant="outline" size="sm" onClick={() => setRequesting(true)}>
                <Plus className="size-4" /> Request a post
              </Button>
            )}
          </div>

          {requesting ? (
            <div className="mt-6">
              <RequestWizard
                fnUrl={FN}
                token={token!}
                headers={headers}
                networks={data.networks ?? []}
                reviewer={data.reviewer}
                onCancel={() => setRequesting(false)}
                onDone={() => {
                  setRequesting(false);
                  void loadFn();
                }}
              />
            </div>
          ) : data.pending.length === 0 ? (
            <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center">
              <Check className="mx-auto size-6 text-[color:var(--pf-olive)]" />
              <p className="mt-2 text-sm text-muted-foreground">
                You're all caught up. Check back when there's something new — this link stays the
                same.
              </p>
              {data.requestsEnabled && (
                <Button variant="action" className="mt-4" onClick={() => setRequesting(true)}>
                  <Plus className="size-4" /> Request a post
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {data.pending.map((p, i) => (
                <ReviewCard key={p.id} post={p} index={i + 1} onDecide={decide} onComment={comment} />
              ))}
            </div>
          )}

          {!requesting && data.scheduled && data.scheduled.length > 0 && (
            <div className="mt-10">
              <h2 className="dateline mb-3">What's coming up</h2>
              <ol className="relative ml-1 space-y-4 border-l border-border pl-5">
                {data.scheduled.map((p) => {
                  const past = new Date(p.scheduled_at).getTime() < Date.now();
                  return (
                    <li key={p.id} className="relative">
                      <span
                        className={`absolute -left-[26px] top-1 size-[9px] rounded-full border-[1.5px] ${
                          past
                            ? 'border-[color:var(--pf-olive)] bg-[color:var(--pf-olive)]'
                            : 'border-input bg-background'
                        }`}
                      />
                      <div className="dateline">
                        {whenLabel(p.scheduled_at)}
                        {p.status === 'published' ? ' · posted' : past ? ' · posting' : ''}
                      </div>
                      <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-sm">
                        {p.body || <span className="text-muted-foreground">(no text)</span>}
                      </p>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 text-xs text-muted-foreground">
                Subscribe in your calendar app — ask {data.reviewer ?? 'your manager'} for the link.
              </p>
            </div>
          )}

          {!requesting && data.recent.length > 0 && (
            <div className="mt-10">
              <button
                type="button"
                onClick={() => setShowRecent((s) => !s)}
                className="dateline"
              >
                {showRecent ? '▾' : '▸'} Recently reviewed ({data.recent.length})
              </button>
              {showRecent && (
                <ul className="mt-2 space-y-2">
                  {data.recent.map((r, i) => (
                    <li key={i} className="rounded-md border border-border bg-card p-3 text-sm">
                      <span className="dateline">
                        {r.event === 'approved' ? 'Approved' : 'Changes requested'} ·{' '}
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                      <p className="mt-1 line-clamp-2 text-muted-foreground">{r.body}</p>
                      {r.note && <p className="mt-1 text-xs italic">“{r.note}”</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReviewCard({
  post,
  index,
  onDecide,
  onComment,
}: {
  post: PendingPost;
  index: number;
  onDecide: (
    id: string,
    decision: 'approved' | 'changes_requested',
    note: string,
  ) => Promise<void>;
  onComment: (id: string, body: string) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [wantChanges, setWantChanges] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);

  async function sendComment() {
    if (!commentText.trim()) return;
    setCommentBusy(true);
    try {
      await onComment(post.id, commentText);
      setCommentText('');
      setCommentOpen(false);
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    } finally {
      setCommentBusy(false);
    }
  }

  async function run(decision: 'approved' | 'changes_requested') {
    if (decision === 'changes_requested' && !note.trim()) {
      setErr('Add a quick note on what to change.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onDecide(post.id, decision, note);
      setDone(decision);
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        {done === 'approved' ? 'Approved — thanks.' : 'Sent back with your notes — thanks.'}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-input bg-card p-4">
      <div className="dateline mb-2">
        Post {index} · {whenLabel(post.scheduled_at)}
      </div>

      {post.lastNote && (
        <p className="mb-3 border-l-2 border-[color:var(--pf-brick)] pl-2.5 text-xs italic text-muted-foreground">
          You asked last time: “{post.lastNote}”
        </p>
      )}

      {post.media.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {post.media.map((u, i) => (
            <img key={i} src={u} alt="" className="max-w-full rounded-md border border-border" />
          ))}
        </div>
      )}

      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
        {post.body || <span className="text-muted-foreground">(no text)</span>}
      </p>

      {post.threadParts.length > 0 && (
        <div className="mt-2 space-y-2 border-l-2 border-border pl-3">
          <span className="dateline">Thread · {post.threadParts.length + 1} posts</span>
          {post.threadParts.map((p, i) => (
            <p key={i} className="whitespace-pre-wrap text-[14px] leading-relaxed">
              {p}
            </p>
          ))}
        </div>
      )}

      {post.comments.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
          {post.comments.map((c, i) => (
            <li key={i} className={`text-[13px] ${c.resolved ? 'opacity-50' : ''}`}>
              <span className="dateline">
                {c.author === 'reviewer' ? 'You' : 'Team'} ·{' '}
                {new Date(c.created_at).toLocaleDateString()}
                {c.resolved ? ' · resolved' : ''}
              </span>
              <p className="whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      {commentOpen && (
        <div className="mt-3 space-y-2">
          <Textarea
            autoFocus
            rows={2}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Leave a note — this won't send the post back."
          />
          <div className="flex gap-2">
            <Button variant="secondary" disabled={commentBusy} onClick={() => void sendComment()}>
              Post comment
            </Button>
            <Button variant="ghost" disabled={commentBusy} onClick={() => setCommentOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {wantChanges ? (
        <div className="mt-3 space-y-2">
          <Textarea
            autoFocus
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What should change?"
          />
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void run('changes_requested')}
            >
              Send back
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setWantChanges(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button variant="action" disabled={busy} onClick={() => void run('approved')}>
            <Check className="size-4" /> Approve
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => setWantChanges(true)}>
            <MessageSquare className="size-4" /> Request changes
          </Button>
          {!commentOpen && (
            <Button variant="ghost" disabled={busy} onClick={() => setCommentOpen(true)}>
              Comment
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
